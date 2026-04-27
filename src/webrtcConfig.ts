export const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun.services.mozilla.com",
      ],
    },
    {
      urls: "turn:free.expressturn.com:3478",
      username: "000000002092206066",
      credential: "Vs7fAQNKq4oYyAWIiZ9MU6oo3uY=",
    },
  ],
  iceCandidatePoolSize: 10,
};
