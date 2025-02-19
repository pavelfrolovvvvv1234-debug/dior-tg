export default async () => {
  return (
    await import("../prices.json", {
      with: {
        type: "json",
      },
    })
  ).default;
};
