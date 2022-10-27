import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

import io from "socket.io-client";
let socket;
if(location.origin.includes(":5173")){
  socket = io("http://localhost:3001", {transports: ["websocket"]});
}else{
  socket = io({transports: ["websocket"]});
}
app.config.globalProperties.$socket = socket;

app.mount("#app");

document.title = "NUSH Chess";
