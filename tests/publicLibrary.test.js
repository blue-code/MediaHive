const request = require("supertest");
const createApp = require("../src/server");

describe("Public Library API", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  it("GET /api/public/library should return 200 and a list of files without authentication", async () => {
    const res = await request(app).get("/api/public/library");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
