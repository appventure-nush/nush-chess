import {RemoteSocket, Server} from "socket.io";
import express from 'express';
import bodyParser from "body-parser";
import http from "http";
import {Chess} from "chess.js";
import verifyToken from "./tokens";
import * as fs from "fs";
import {
  ClientToServerEvents,
  GameStatus, Group,
  InterServerEvents,
  Role,
  ServerToClientEvents,
  SocketData,
  WaitingReason
} from "./types";
import setupDatabase from "./database/setupdatabase";
import {
  completeGame,
  newGame,
  leaderboard,
  registerUser,
  registerVote,
  registerVotingResults,
  winStats,
  getUserTeam
} from "./database/api";
import {getGroupFromRole, getRoleFromGroup, nextGameTime, otherGroup, sum} from "./util";
import {ManagedTimer} from "./ManagedTimer";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const server = http.createServer(app);

const game = new Chess();
let gameId = -1;

let votes: Map<string, number> | null = null;
let votingTimeout: ManagedTimer | null = null;
let votingRounds = 0;
let gameResetTimer: ManagedTimer | null = null;

const {
  votingTimeoutSeconds,
  numRequiredPlayers,
  votingThreshold,
  intergameDelaySeconds,
  allowRoleOverride,
  noVoteThreshold
} = JSON.parse(fs.readFileSync("./config.json", "ascii"))

// Groups start from 1
const playersPerGroup = [1, 0, 0];
let winsPerGroup = [1, 0, 0];

let currentGroupOne: Role = "w";
let gameStatus: GameStatus = "waiting";
let waitingReason: WaitingReason = "noPlayers";

const io = new Server<ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData>(server, {
  cors: {
    origin: "http://localhost:5137",
    methods: ["GET", "POST"]
  },
  transports: ["websocket"],
  pingInterval: 5000,
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
    if (game.turn() != getRoleFromGroup(socket.data.group, currentGroupOne)) {
      socket.emit("error", "Not your turn");
      return;
    }
    if (socket.data.hasVoted) {
      socket.emit("error", "You have already voted.");
      return;
    }

    const result = game.move(move);
    if (result == null) {
      socket.emit("error", "Invalid move");
      return;
    }
    // We don't actually want to make that move yet
    game.undo();
    if(!await registerVote(gameId, votingRounds, socket.data.email, move)){
      socket.emit("error", "You have already voted.");
      return;
    }
    if (votes == null) {
      return;
    }
    if (votes.has(move)) {
      votes.set(move, votes.get(move)!! + 1)
    } else {
      votes.set(move, 1);
    }

    socket.data.hasVoted = true;

    const numVotes = sum(Array.from(votes.values()));
    const players = playersPerGroup[getGroupFromRole(game.turn(), currentGroupOne)];

    // Number of votes have passed threshold
    if (gameStatus == "playing" && (players == 0 || numVotes / players >= votingThreshold)) {
      tallyVotes();
    } else {
      sendVotingUpdate();
    }
  })

  socket.on("auth", async (sent_name) => {
    try {
      const name = sent_name;
      const unique_name = sent_name;

      const sockets = await io.fetchSockets();

      socket.data.username = name;
      socket.data.hasVoted = false;
      socket.data.numSkippedVotes = 0;

      if (!allowRoleOverride) {
        const s = sockets.find(s => s.data.email == unique_name);
        if (s && !["h1710074@nushigh.edu.sg", "h1710051@nushigh.edu.sg", "h1710013@nushigh.edu.sg"]
          .includes(unique_name)) {
          socket.emit("error", "You have already joined, or there is another user with the same name!");
          // s.emit("error", "You have already joined, or there is another user with the same name!");
          socket.disconnect(); // disconnect second copy
          // s.disconnect();
          return;
        }
        // if (socket.data.username.toLowerCase().charCodeAt(0) <= "l".charCodeAt(0)) {
        //   socket.data.group = 1;
        // } else {
        //   socket.data.group = 2;
        // }
        socket.data.group = await getUserTeam(unique_name);
        if (!socket.data.group) {
          socket.data.group = Math.random() > 0.5 ? 2 : 1;
        }
      } else {
        socket.data.group = Math.random() > 0.5 ? 2 : 1;
      }
      await registerUser(unique_name, name, socket.data.group);
      socket.data.email = unique_name;

      console.log("Connected", socket.data.group);


      if (unique_name !== "admin") playersPerGroup[socket.data.group] += 1;
      console.log("players per group", playersPerGroup);

      if (gameStatus == 'waiting') {
        // Game is not in play and minimum players are satisfied
        if (Math.min(playersPerGroup[1], playersPerGroup[2]) >= numRequiredPlayers) {
          if (!gameResetTimer?.running()) {
            await resetAfterDelay(false);
            await sendGameInfoToAll();
          }
        }
      } else {
        sendVotingUpdate();
      }
      socket.emit("gameInfo", {
        gameStatus,
        waitingReason,
        role: getRoleFromGroup(socket.data.group, currentGroupOne),
        group: socket.data.group,
        playersPerGroup, winsPerGroup,
        nextGameTime: nextGameTime(gameStatus, gameResetTimer),
      });
      if (gameStatus == "playing" && votingTimeout != null) {
        socket.emit("state", {fen: game.fen(), nextVoteTime: votingTimeout.timeoutTime});
      }
    } catch (e: any) {
      socket.emit("error", e);
    }
  })

  socket.on("leaderboard", (callback) => {
    if (!socket.data.group || !socket.data.email) {
      socket.emit("error", "unauth");
      return;
    }
    leaderboard().then(data => {
      callback(data);
    })
  })

  socket.on("disconnect", () => {
    if (!socket.data.group) {
      return
    }
    console.log("Disconnected", socket.data.group);
    playersPerGroup[socket.data.group] -= 1;
    console.log("players per group", playersPerGroup);
    // Maybe not enough players for game?
    if (gameResetTimer?.running()) {

      if (Math.min(...playersPerGroup) < numRequiredPlayers) {
        gameResetTimer?.cancel();
        gameStatus = "waiting";
        waitingReason = "noPlayers";
        gameId = -1;
        sendGameInfoToAll();
      }
    }

    // Skip voting check if no vote, or user kicked because of non voting
    if (votes == null || (socket.data.numSkippedVotes && socket.data.numSkippedVotes >= noVoteThreshold)) {
      return;
    }
    const numVotes = sum(Array.from(votes.values()));
    const players = playersPerGroup[getGroupFromRole(game.turn(), currentGroupOne)];

    // Number of votes have passed threshold
    if (gameStatus == "playing" && (players == 0 || numVotes / players >= votingThreshold)) {
      tallyVotes();
    } else {
      sendVotingUpdate();
    }
  })
})

async function reset(switchTeams = true) {
  gameStatus = "playing";
  waitingReason = "";
  if (votingTimeout != null) {
    votingTimeout.cancel();
  }
  if (switchTeams) {
    if (currentGroupOne == "w") {
      currentGroupOne = "b";
    } else {
      currentGroupOne = "w";
    }
  }
  gameId = await newGame(getGroupFromRole("w", currentGroupOne));
  votingRounds = 0;
  game.reset();
  newVote();
  await sendGameInfoToAll();
  if (votingTimeout != null) {
    io.emit("state", {fen: game.fen(), nextVoteTime: votingTimeout.timeoutTime});
  }
}

async function tallyVotes() {
  if (votes == null) {
    return;
  }
  votingTimeout?.cancel();
  gameResetTimer?.cancel();
  console.log(`Voting round: ${votingRounds}`);
  console.log(votes);
  const sorted = Array.from(votes.entries()).sort((a, b) => {
    const aNum = a[1];
    const bNum = b[1];
    if (aNum == bNum) {
      return Math.random() - 0.5;
    }
    return bNum - aNum;
  }).slice(0, 10);

  const currentGroup = getGroupFromRole(game.turn(), currentGroupOne);

  await pruneUsers(currentGroup);

  if (sorted.length == 0) {
    // :skull:
    gameStatus = "waiting";
    waitingReason = "noVotes";
    if (Math.min(...playersPerGroup) != 0) {
      resetAfterDelay();
    }
    finishGame(otherGroup(currentGroup), true);
    return;
  }

  game.move(sorted[0][0]);
  const totalVotes = sum(Array.from(votes.values()));
  await registerVotingResults(gameId, votingRounds, sorted[0][0], sorted[0][1], totalVotes);
  for (const socket of await io.fetchSockets()) {
    if (socket.data.group == currentGroup) {
      socket.emit("votes", sorted)
    }
  }
  votingRounds++;
  newVote();
  if (votingTimeout != null) {
    io.emit("state", {fen: game.fen(), nextVoteTime: votingTimeout.timeoutTime});
  }
  if (game.isCheckmate()) {
    waitingReason = "gameCompleted";
    resetAfterDelay();
    finishGame(currentGroup, false);
    return;
  }
  if (game.isDraw()) {
    waitingReason = "gameCompleted";
    gameStatus = "waiting";
    resetAfterDelay();
    sendGameInfoToAll();
    gameId = -1;
    return;
  }
}

function finishGame(winningGroup: Group, timeout: boolean) {
  gameStatus = "waiting";
  io.emit("winner", {winnerGroup: winningGroup, timeout});
  winsPerGroup[winningGroup] += 1;
  sendGameInfoToAll();
  completeGame(gameId, winningGroup, timeout);
  gameId = -1;
}

function resetAfterDelay(switchTeams = true) {
  votingTimeout?.cancel();
  gameResetTimer?.cancel();
  gameResetTimer = new ManagedTimer(() => reset(switchTeams), intergameDelaySeconds * 1000);
}

function sendVotingUpdate() {
  if (votes == null) {
    return
  }
  const numVotes = sum(Array.from(votes.values()));
  const players = playersPerGroup[getGroupFromRole(game.turn(), currentGroupOne)];
  io.emit("votingUpdate", {numVotes, players})
}

async function sendGameInfoToAll() {
  const sockets = await io.sockets.fetchSockets();
  for (const socket of sockets) {
    if (socket.data.group) {
      socket.emit("gameInfo", {
        gameStatus,
        waitingReason,
        role: getRoleFromGroup(socket.data.group, currentGroupOne),
        group: socket.data.group,
        playersPerGroup, winsPerGroup,
        nextGameTime: nextGameTime(gameStatus, gameResetTimer),
      });
    }
  }
}

async function pruneUsers(currentGroup: Group) {
  const sockets = await io.sockets.fetchSockets();
  const _playersPerGroup = [0, 0, 0];
  for (const socket of sockets) {
    if (socket.data.group == currentGroup) {
      if (!socket.data.hasVoted) {
        socket.data.numSkippedVotes += 1;
      } else {
        // Reset on votes
        socket.data.numSkippedVotes = 0;
      }
      if (socket.data.numSkippedVotes >= noVoteThreshold &&
        !["h1710074@nushigh.edu.sg", "h1710051@nushigh.edu.sg", "h1710013@nushigh.edu.sg", "admin"]
          .includes(socket.data.email)) {
        // Bye
        console.log("kicked", socket.id);
        socket.emit("error", "You have been disconnected for not voting");
        socket.disconnect();
        continue;
      }
    }
    _playersPerGroup[socket.data.group] += 1;
    socket.data.hasVoted = false;
  }
  playersPerGroup[1] = _playersPerGroup[1];
  playersPerGroup[2] = _playersPerGroup[2];
}

function newVote() {
  votes = new Map<string, number>();
  if (votingTimeout != null) {
    votingTimeout.cancel();
  }
  votingTimeout = new ManagedTimer(tallyVotes, 1000 * votingTimeoutSeconds);
  sendVotingUpdate();
}

app.use(express.static('../frontend/dist'))

setupDatabase().then(() => {
  winStats().then(result => {
    winsPerGroup = result;
  })
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});