import {Server} from "socket.io";
import express, {Application, NextFunction} from 'express';
import bodyParser from "body-parser";
import path from "path";
import http from "http";
import {Chess} from "chess.js";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const server = http.createServer(app);

const io = new Server(server);

const game = new Chess();

io.on("connection", (socket)=>{
  console.log("New connection", socket.id)

  socket.on("move", (move)=>{
    if(!socket.data.role){
      socket.emit("error", "Select a role first");
      return;
    }
    if(game.turn() != socket.data.role[0]){
      socket.emit("error", "Not your turn");
      return;
    }
    const result = game.move(move);
    if(result == null){
      socket.emit("error", "Invalid move");
      return;
    }
    socket.broadcast.emit("state", game.fen());
  })

  socket.on("reset", ()=>{
    game.reset()
    io.emit("state", game.fen());
  })

  socket.on("role", (role)=>{
    if(!["white", "black"].includes(role)){
      return socket.emit("error", "invalid role");
    }
    socket.data.role = role;
    console.log(socket.id, role);
    socket.emit("state", game.fen());
  })
})


server.listen(3000, () => {
  console.log('listening on *:3000');
});