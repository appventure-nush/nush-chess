<template>
  <div class="flex flex-col gap-4">
    <div v-if="state.auth || true" class="flex flex-col items-center gap-4">
      <span class="fixed top-0 left-0 p-4 text-xl">
        chess.<span class="text-nush-light">nush</span>.app
      </span>
      <div class="flex-1">
        <div class="flex flex-col items-center gap-4 w-[80vw] max-w-[50vh]">
          <!-- top bar -->

          <div class="flex my-4 justify-evenly w-[80vw] max-w-[50vh]">
            <!-- chessboard -->
            <div
              :class="
                'p-2 border rounded' +
                (state.tab == 0 ? ' shadow-[0_0_10px_#FFFFFF]' : '')
              "
              @click="state.tab = 0"
            >
              <svg style="width: 24px; height: 24px" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M2 2V22H22V2H2M20 12H16V16H20V20H16V16H12V20H8V16H4V12H8V8H4V4H8V8H12V4H16V8H20V12M16 8V12H12V8H16M12 12V16H8V12H12Z"
                />
              </svg>
            </div>

            <!-- history -->
            <div
              :class="
                'p-2 border rounded ' +
                (state.tab == 1 ? 'shadow-[0_0_10px_#FFFFFF]' : '')
              "
              @click="state.tab = 1"
            >
              <svg style="width: 24px; height: 24px" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"
                />
              </svg>
            </div>

            <!-- leaderboard -->
            <div
              :class="
                'p-2 border rounded ' +
                (state.tab == 2 ? 'shadow-[0_0_10px_#FFFFFF]' : '')
              "
              @click="state.tab = 2"
            >
              <svg style="width: 24px; height: 24px" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M18 2C17.1 2 16 3 16 4H8C8 3 6.9 2 6 2H2V11C2 12 3 13 4 13H6.2C6.6 15 7.9 16.7 11 17V19.08C8 19.54 8 22 8 22H16C16 22 16 19.54 13 19.08V17C16.1 16.7 17.4 15 17.8 13H20C21 13 22 12 22 11V2H18M6 11H4V4H6V11M20 11H18V4H20V11Z"
                />
              </svg>
            </div>
          </div>

          <!-- sidebar -->
          <div class="grid align-middle gap-4 grid-cols-2"></div>

          <!-- tab view -->
          <div class="h-[60vh] max-h-[60vh]">
            <!-- status and board -->
            <div
              v-if="state.tab == 0"
              class="flex flex-col align-middle justify-center"
            >
              <div class="text-2xl mb-2">
                <span> {{ state.status }} </span>
              </div>
              <Board
                class="w-[80vw] max-w-[50vh]"
                @updateStatus="updateStatus(state.game)"
                @vote="setVoted()"
                :fen="state.fen"
                :role="state.role"
                id="chessboard"
                :game="state.game"
              ></Board>
            </div>

            <!-- vote history -->
            <div
              v-if="state.tab == 1"
              class="flex flex-1 flex-col items-center justify-center"
            >
              <span class="text-lg mb-4"
                >Top 10 votes for the previous round</span
              >
              <div
                class="
                  w-[60vw]
                  max-w-[50vh]
                  outline outline-1 outline-[#F0D9B5]
                  rounded
                  py-2
                  px-4
                "
              >
                <div class="flex flex-col" v-if="state.votes.length">
                  <div v-for="vote in state.votes" :key="vote">
                    {{ `${vote[0]}: ${vote[1]} votes` }}
                  </div>
                </div>
                <div class="min-h-[4rem] flex align-middle" v-else>
                  <div class="m-auto">No votes</div>
                </div>
              </div>
            </div>

            <!-- leaderboard -->
            <div
              v-if="state.tab == 2"
              class="flex flex-1 flex-col items-center justify-center"
            >
              <div
                class="
                  grid grid-cols-2
                  text-lg
                  gap-4
                  mb-4
                  w-[80vw]
                  max-w-[50vh]
                "
              >
                <div class="bg-chess-light text-black p-4 rounded-lg">
                  <span class="text-xl">Team A</span>
                  <br />
                  <span> {{ awins }} win{{ awins == 1 ? "" : "s" }} </span>
                </div>

                <div class="bg-chess-dark rounded-lg p-4">
                  <span class="text-xl">Team Z</span>
                  <br />
                  <span> {{ zwins }} win{{ zwins == 1 ? "" : "s" }} </span>
                </div>
              </div>

              <span class="text-lg">Leaderboard</span>
              <div
                class="
                  w-[60vw]
                  max-w-[50vh]
                  outline outline-1 outline-[#F0D9B5]
                  rounded
                  py-2
                  px-4
                "
              >
                <div class="flex flex-col" v-if="state.leaderboard.length">
                  <span v-for="entry of state.leaderboard" :key="entry.username">
                    {{ `${entry.username}: ${entry.winning_votes} points` }}
                  </span>
                </div>
                <div class="min-h-[4rem] flex align-middle" v-else>
                  <svg
                    class="animate-spin h-5 w-5 m-auto text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-evenly items-center gap-4 w-[80vw] max-w-[50vh]">
        <div
          class="
            outline-none
            rounded
            bg-chess-light
            text-black
            flex flex-col
            items-center
            justify-center
            p-2
          "
        >
          <span class="text-md"
            >Team
            <span class="whitespace-nowrap italic">
              {{ teamNumToName(state.group) }}</span
            >
          </span>
          <img
            :src="`https://chessboardjs.com/img/chesspieces/alpha/${state.role}K.png`"
            class="w-12 h-12 m-auto"
          />
        </div>

        <div>
          <!--  If game is in play, show voting timeout  -->
          <div
            v-if="state.gameStatus === 'playing'"
            class="outline-none rounded p-4 bg-[#B58863] text-white text-md"
          >
            <span>Voting window</span> <br />

            <span class="font-mono text-md">
              {{
                Math.max(
                  (state.nextVoteTimestamp - state.time.getTime()) / 1000,
                  0
                ).toFixed(2)
              }}s
            </span>
            <br />
          </div>
          <!--  If waiting for game start, show countdown  -->
          <div
            v-else-if="state.nextGameTime > 0"
            class="outline-none rounded p-4 bg-[#B58863] text-white text-md"
          >
            <span>Game starts in</span> <br />
            <span class="font-mono text-md">
              {{
                Math.max(
                  (state.nextGameTime - state.time.getTime()) / 1000,
                  0
                ).toFixed(2)
              }}s
            </span>
          </div>
          <!--  Waiting for players  -->
          <div
            v-else
            class="outline-none rounded p-4 bg-[#B58863] text-white text-md"
          >
            <span>Waiting for players</span> <br />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-2 mb-10">
      <span class="text-2xl">
        chess.<span class="text-nush-mid">nush</span>.app
      </span>
      <br />
      <button
        class="
          transition
          bg-nush-dark
          hover:bg-nush-mid
          outline-none
          text-white
          font-bold
          py-2
          px-4
          rounded
        "
        @click="signIn"
      >
        Enter with Office365
      </button>
    </div>
  </div>
</template>

<script>
import Board from "./components/Board.vue";
import TestBoard from "./components/TestBoard.vue";

import { Chess } from "chess.js";

import { reactive, ref } from "vue";

export default {
  name: "App",
  components: {
    Board,
    TestBoard,
  },

  setup() {
    const state = reactive({
      tab: 0,
      leaderboard: [],

      group: 0,
      auth: false,
      status: "Waiting...",
      // Either waiting or playing
      gameStatus: "waiting",
      nextGameTime: -1,
      voted: false,
      role: "",
      fen: "",
      votes: [],
      numVotes: 0,
      numPlayers: 0,
      numWins: [1, 0, 0],
      errors: [],
      nextVoteTimestamp: 0,
      game: {},
      time: {},
    });

    return { state };
  },

  created() {
    setInterval(() => {
      this.state.time = new Date();
    }, 10);
  },

  computed: {
    awins() {
      return this.state.numWins[1];
    },
    zwins() {
      return this.state.numWins[2];
    },
  },

  methods: {
    refreshLeaderboard() {
      const socket = this.$socket;
      socket.emit("leaderboard", (leaderboard) => {
        this.state.leaderboard = leaderboard;
      });
    },

    teamNumToName(num) {
      return ["A", "Z"][num - 1];
    },

    signIn() {
      location.href =
        `https://login.microsoftonline.com/d72a7172-d5f8-4889-9a85-d7424751592a/oauth2/authorize?` +
        `client_id=c8115b04-01cf-451e-a9bb-95170936d45e&` +
        `redirect_uri=${location.origin}&` +
        `response_type=id_token&nonce=distributed-chess&scopes=User.Read`;
    },

    updateStatus(game) {
      console.log("update");
      let status = "";
      const currTurn = game.turn();
      let moveCol = currTurn == "w" ? "White" : "Black";

      if (game.isCheckmate()) {
        status = `Checkmate! ${moveCol} wins.`;
      } else if (game.isDraw()) {
        status = "Draw.";
      } else {
        console.log(this.state.voted);
        if (currTurn !== this.state.role[0]) {
          if (this.state.voted) {
            status = `You have already voted`;
          } else {
            status = `It is not your turn`;
          }
        } else {
          status = `You have not voted yet`;
        }
        if (game.isCheck()) {
          status += `, ${moveCol} is in check.`;
        } else {
          status += ".";
        }
      }

      this.state.status = status;
    },

    setVoted() {
      console.log("Voted");
      this.state.voted = true;
      console.log("voted", this.state.voted);
    },

    initGame() {},
  },

  mounted() {
    let game = new Chess();
    this.state.game = game;
    console.log(game);

    const socket = this.$socket;
    let app = this;

    socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    socket.on("state", ({ fen, nextVoteTime }) => {
      console.log("Got state", fen);
      app.state.nextVoteTimestamp = nextVoteTime;
      app.state.voted = false;
      app.state.game.load(fen);
      app.state.fen = fen;
      app.updateStatus(game);
    });

    socket.on(
      "gameInfo",
      ({
        role: _role,
        playersPerGroup,
        winsPerGroup,
        gameStatus,
        waitingReason,
        group,
        nextGameTime,
      }) => {
        app.state.role = _role;
        app.state.group = group;
        app.state.numWins = winsPerGroup;
        app.state.votes = [];
        app.state.gameStatus = gameStatus;
        app.state.nextGameTime = nextGameTime;
        if (gameStatus === "waiting") {
          if (waitingReason === "noVotes") {
            // NO need to do anything here
            // Handled by winner event
          } else if (waitingReason === "noPlayers") {
            this.state.status = "Waiting for more players to join.";
            app.state.game.reset();
          } else if (waitingReason === "gameCompleted") {
            console.log(this.state.status);
          }
        } else {
          app.initGame();
        }

        app.refreshLeaderboard();
        }
    );

    socket.on("votes", (votes) => {
      console.log(votes);
      app.state.votes = votes;
      app.state.voted = false;
    });

    socket.on("winner", ({ winnerGroup, timeout }) => {
      if (timeout) {
        app.state.status = `Team ${this.teamNumToName(
          winnerGroup
        )} won because the other team did not vote.`;
      } else {
        app.state.status = `Team ${this.teamNumToName(winnerGroup)} won.`;
      }
      app.state.nextVoteTimestamp = new Date().getTime();
    });

    socket.on("votingUpdate", ({ numVotes, players }) => {
      app.state.numVotes = numVotes;
      app.state.numPlayers = players;
    });

    socket.on("error", (error) => {
      console.log(error);
      if (error.includes("not voting") || error.includes("already joined")) {
        alert(error);
      }
      app.state.errors.push(error);
    });

    if (location.hash.length !== 0) {
      localStorage.setItem("token", location.hash.substring(10).split("&")[0]);
      location.hash = "";
    }

    this.state.auth = localStorage.getItem("token");
    socket.on("connect", () => {
      if (location.origin.includes("http://")) {
        document.title = socket.id;
      }
      if (this.state.auth) {
        socket.emit("auth", this.state.auth);
      }
    });
  },
};
</script>

<style scoped>
</style>
