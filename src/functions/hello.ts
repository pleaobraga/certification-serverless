export const handle = async (event) => {
  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "hello word",
    }),
    headers: {
      "Content-Type": "application/json",
    },
  };
};
