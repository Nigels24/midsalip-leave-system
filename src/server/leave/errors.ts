// An expected rule violation ("Insufficient vacation leave credits...").
// Pages and server actions catch LeaveError and show its message to the user.
// Any other error is a real bug or a database problem and is NOT caught.
export class LeaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaveError";
  }
}
