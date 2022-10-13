import {Server} from "socket.io";
import express, {Application, NextFunction} from 'express';
import bodyParser from "body-parser";
import path from "path";
import http from "http";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const server = http.createServer(app);

const io = new Server(server);

let default_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let globalState = default_fen;

io.on("connection", (socket)=>{
  console.log("New connection", socket.id)

  socket.emit("state", globalState);

  socket.on("state", (state)=>{
    // TODO: check is state is valid
    // TODO: prevent players from playing both sides
    globalState = state;
    socket.broadcast.emit("state", state);
  })

  socket.on("reset", ()=>{
    globalState = default_fen;
    io.emit("state", default_fen);
  })
})


server.listen(3000, () => {
  console.log('listening on *:3000');
});