import {GameStatus, Group, Role} from "./types";
import {ManagedTimer} from "./ManagedTimer";

export function getRoleFromGroup(group: Group, currentGroupOne: Role): Role | false {
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

export function getGroupFromRole(role: Role, currentGroupOne: Role): Group {
  if (role == currentGroupOne) {
    return 1;
  }
  return 2;
}

export function otherGroup(group: Group): Group {
  if (group == 1) return 2;
  return 1;
}

export function sum(arr: number[]) {
  let res = 0;
  for (const elem of arr) {
    res += elem;
  }
  return res;
}

export function nextGameTime(gameStatus: GameStatus, timer: ManagedTimer | null){
  if(gameStatus == "playing"){
    return new Date().getTime();
  }
  if(!timer || timer.timeoutTime < new Date().getTime()){
    return -1;
  }
  return timer.timeoutTime;
}