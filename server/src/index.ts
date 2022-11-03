import {Server, Socket} from "socket.io";
import express from 'express';
import bodyParser from "body-parser";
import http from "http";
import {Chess} from "chess.js";
import verifyToken from "./tokens";
import * as fs from "fs";
import {
  ClientToServerEvents,
  GameStatus,
  Group,
  InterServerEvents,
  Role,
  ServerToClientEvents,
  SocketData, WaitingReason
} from "./types";
import setupDatabase from "./database/setupdatabase";
import {completeGame, newGame, registerVote} from "./database/api";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const server = http.createServer(app);

const game = new Chess();
let gameId = -1;

let votes: Map<string, number> | null = null;
let votingTimeout: NodeJS.Timeout | null = null;
let nextVoteTime: number = 0;
let votingRounds = 0;

const {
  votingTimeoutSeconds,
  numRequiredPlayers,
  votingThreshold,
  intergameDelaySeconds,
  allowRoleOverride
} = JSON.parse(fs.readFileSync("./config.json", "ascii"))

// Groups start from 1
const playersPerGroup = [1, 0, 0];
const winsPerGroup = [1, 0, 0];

let currentGroupOne: Role = "w";
let gameStatus: GameStatus = "waiting";
let waitingReason: WaitingReason = "noPlayers";

function getRoleFromGroup(group: Group): Role | false {
  if (group == 1) {
    return currentGroupOne;
  } else if (group == 2) {
    if (currentGroupOne == "w") {
      return "b";
    } else {
      return "w";
    }
  }
  return false;
}

function getGroupFromRole(role: Role): Group {
  if (role == currentGroupOne) {
    return 1;
  }
  return 2;
}

function otherGroup(group: Group): Group{
  if(group == 1) return 2;
  return 1;
}

const io = new Server<ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData>(server, {
  cors: {
    origin: "http://localhost:5137",
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

io.on("connection", (socket) => {
  socket.on("vote", async (move) => {
    if (gameStatus != "playing") {
      socket.emit("error", "The game is not in play");
      return;
    }
    if (!socket.data.group || !socket.data.email) {
      socket.emit("error", "You are not authenticated");
      return;
    }
    if (game.turn() != getRoleFromGroup(socket.data.group)) {
      socket.emit("error", "Not your turn");
      return;
    }
    const result = game.move(move);
    if (result == null) {
      socket.emit("error", "Invalid move");
      return;
    }
    // We don't actually want to make that move yet
    game.undo();
    if (votes == null) {
      return;
    }
    if (votes.has(move)) {
      votes.set(move, votes.get(move)!! + 1)
    } else {
      votes.set(move, 1);
    }

    await registerVote(gameId, socket.data.email, move);

    const numVotes = sum(Array.from(votes.values()));
    const players = playersPerGroup[getGroupFromRole(game.turn())];

    // Number of votes have passed threshold
    if (players > 0 && numVotes / players >= votingThreshold) {
      await tallyVotes();
    }else{
      sendVotingUpdate();
    }
  })

  socket.on("auth", async (token) => {
    try {
      const decodedToken = (await verifyToken(token)) as {
        // eslint-disable-next-line camelcase
        unique_name: string
        name: string
      } | null;
      if (decodedToken == null) {
        socket.emit("error", "Invalid token");
        return;
      }

      const sockets = await io.fetchSockets();
      // if (sockets.some(s => s.data.email == decodedToken.unique_name)) {
      //   return socket.emit("error", "You have already joined");
      // }

      socket.data.email = decodedToken.unique_name;
      socket.data.username = decodedToken.name;


      // if (socket.data.username.toLowerCase().charCodeAt(0) <= "l".charCodeAt(0)) {
      //   socket.data.group = 1;
      // } else {
      //   socket.data.group = 2;
      // }

      socket.data.group = Math.random() > 0.5 ? 2 : 1;

      playersPerGroup[socket.data.group] += 1;

      console.log(Math.min(playersPerGroup[1], playersPerGroup[2]), gameStatus);
      if (gameStatus == 'waiting') {
        // Game is not in play and minimum players are satisfied
        if (Math.min(playersPerGroup[1], playersPerGroup[2]) >= numRequiredPlayers) {
          await reset(false);
        }
      } else {
        sendVotingUpdate();
      }
      socket.emit("gameInfo", {
        gameStatus,
        waitingReason,
        role: getRoleFromGroup(socket.data.group),
        group: socket.data.group,
        playersPerGroup, winsPerGroup
      });
      if (gameStatus == "playing") {
        socket.emit("state", {fen: game.fen(), nextVoteTime});
      }
    } catch (e: any) {
      socket.emit("error", e);
    }
  })

  socket.on("disconnect", () => {
    if (!socket.data.group) {
      return
    }
    console.log("Disconnected");
    playersPerGroup[socket.data.group] -= 1;
  })
})

function sum(arr: number[]) {
  let res = 0;
  for (const elem of arr) {
    res += elem;
  }
  return res;
}

async function reset(switchTeams=true) {
  gameStatus = "playing";
  waitingReason = "";
  if (votingTimeout != null) {
    clearTimeout(votingTimeout);
  }
  if(switchTeams){
    if (currentGroupOne == "w") {
      currentGroupOne = "b";
    } else {
      currentGroupOne = "w";
    }
  }
  console.log("Starting new game...");
  gameId = await newGame(getGroupFromRole("w"));
  console.log(gameId);
  votingRounds = 0;
  game.reset()
  newVote();
  await sendGameInfoToAll();
  io.emit("state", {fen: game.fen(), nextVoteTime});
}

async function tallyVotes() {
  if (votes == null) {
    return;
  }
  console.log(`Voting round: ${votingRounds}`);
  console.log(votes);
  votingRounds++;
  const sorted = Array.from(votes.entries()).sort((a, b) => {
    const aNum = a[1];
    const bNum = b[1];
    return bNum - aNum;
  }).slice(0, 10);

  const currentGroup = getGroupFromRole(game.turn());

  if (sorted.length == 0) {
    // :skull:
    io.emit("error", "No votes!");
    gameStatus = "waiting";
    if (Math.min(...playersPerGroup) == 0) {
      waitingReason = "noPlayers";
    } else {
      waitingReason = "noVotes";
      resetAfterDelay();
    }
    io.emit("winner", {winnerGroup: otherGroup(currentGroup), timeout: true});
    winsPerGroup[otherGroup(currentGroup)] += 1;
    await sendGameInfoToAll();
    await completeGame(gameId, otherGroup(currentGroup), true);
    gameId = -1;
    return;
  }

  game.move(sorted[0][0]);
  newVote();
  io.emit("state", {fen: game.fen(), nextVoteTime});
  io.emit("votes", sorted);
  if (game.isCheckmate()) {
    io.emit("winner", {winnerGroup: currentGroup, timeout: false});
    winsPerGroup[currentGroup] += 1;
    gameStatus = "waiting";
    waitingReason = "gameCompleted";
    resetAfterDelay();
    await sendGameInfoToAll();
    await completeGame(gameId, currentGroup, false);
    gameId = -1;
    return;
  }
}

function resetAfterDelay(){
  setTimeout(reset, intergameDelaySeconds*1000);
}

function sendVotingUpdate() {
  if (votes == null) {
    return
  }
  const numVotes = sum(Array.from(votes.values()));
  const players = playersPerGroup[getGroupFromRole(game.turn())];

  io.emit("votingUpdate", {numVotes, players})
}

async function sendGameInfoToAll() {
  const sockets = await io.sockets.fetchSockets();
  for (const socket of sockets) {
    if (socket.data.group) {
      socket.emit("gameInfo", {
        gameStatus,
        waitingReason,
        role: getRoleFromGroup(socket.data.group),
        group: socket.data.group,
        playersPerGroup, winsPerGroup
      });
    }
  }
}

function newVote() {
  votes = new Map<string, number>();
  if (votingTimeout != null) {
    clearTimeout(votingTimeout);
  }
  votingTimeout = setTimeout(tallyVotes, 1000 * votingTimeoutSeconds);
  nextVoteTime = new Date().getTime() + 1000 * votingTimeoutSeconds;
  sendVotingUpdate();
}

app.use(express.static('../frontend/dist'))

setupDatabase();

server.listen(3001, () => {
  console.log('listening on *:3001');
});