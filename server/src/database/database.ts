import {Client} from "pg";
import * as fs from "fs";

const config = JSON.parse(fs.readFileSync("./config.json", "ascii"))

const connection = new Client({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
});

connection.connect();

export default connection;