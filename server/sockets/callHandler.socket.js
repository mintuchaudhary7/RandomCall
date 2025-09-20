// callHandler.socket.js
const waitingUsers = new Map();

export default function callHandler(io, socket) {
  console.log("New user connected:", socket.id);

  socket.on("start_call", ({ userId }) => {
    console.log(`User ${userId} (${socket.id}) is looking for a call`);

    if (waitingUsers.size > 0) {
      // get first waiting user
      const [waitingSocketId, waitingUserId] = waitingUsers.entries().next().value;
      waitingUsers.delete(waitingSocketId);

      // The user who just requested (socket) will be the initiator (caller).
      io.to(socket.id).emit("call_matched", {
        peerId: waitingSocketId,
        peerUserId: waitingUserId,
        initiator: true, // this one should create the offer
      });

      // The waiting user will be the callee (not initiator)
      io.to(waitingSocketId).emit("call_matched", {
        peerId: socket.id,
        peerUserId: userId,
        initiator: false,
      });

      console.log(`Paired ${userId} (initiator) <--> ${waitingUserId} (callee)`);
    } else {
      waitingUsers.set(socket.id, userId);
      console.log(`User ${userId} added to waiting list`);
    }
  });

  socket.on("offer", ({ peerId, offer }) => {
    io.to(peerId).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ peerId, answer }) => {
    io.to(peerId).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice_candidate", ({ peerId, candidate }) => {
    io.to(peerId).emit("ice_candidate", { from: socket.id, candidate });
  });

  socket.on("end_call", ({ peerId }) => {
    io.to(peerId).emit("end_call");
  });

  socket.on("disconnect", () => {
    waitingUsers.delete(socket.id);
    console.log("User disconnected:", socket.id);
  });
}
