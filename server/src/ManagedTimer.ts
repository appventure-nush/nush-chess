export class ManagedTimer {
  func: () => void;
  timeout: number;
  private timeoutRef: NodeJS.Timeout
  timeoutTime : number;

  constructor(func: () => void, timeout: number) {
    this.func = func;
    this.timeout = timeout;
    this.timeoutRef = setTimeout(func, timeout);
    this.timeoutTime = new Date().getTime() + timeout;
  }

  cancel() {
    clearTimeout(this.timeoutRef);
  }

  restart() {
    this.cancel();
    this.timeoutRef = setTimeout(this.func, this.timeout);
    this.timeoutTime = new Date().getTime() + this.timeout;
  }


}