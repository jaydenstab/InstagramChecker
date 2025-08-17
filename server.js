const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Utility: safely extract usernames + timestamps
function extractUsers(json, key) {
  if (!json[key] || !Array.isArray(json[key])) return [];
  return json[key]
    .map(entry => {
      const data = entry.string_list_data?.[0];
      if (!data || !data.value) return null;
      return {
        value: data.value,
        timestamp: data.timestamp || 0
      };
    })
    .filter(Boolean);
}

// Upload endpoint
app.post(
  "/upload",
  upload.fields([
    { name: "followers" },
    { name: "following" }
  ]),
  (req, res) => {
    try {
      const followersRaw = JSON.parse(fs.readFileSync(req.files.followers[0].path, "utf8"));
      const followingRaw = JSON.parse(fs.readFileSync(req.files.following[0].path, "utf8"));

      const followers = extractUsers(followersRaw, "relationships_followers");
      const following = extractUsers(followingRaw, "relationships_following");

      // Compare following vs followers
      let notFollowingBack = following.filter(f =>
        !followers.some(fl => fl.value.toLowerCase() === f.value.toLowerCase())
      );

      // Sorting query
      const sort = req.query.sort;
      if (sort === "asc") {
        notFollowingBack.sort((a, b) => a.value.localeCompare(b.value));
      } else if (sort === "desc") {
        notFollowingBack.sort((a, b) => b.value.localeCompare(a.value));
      } else if (sort === "earliest") {
        notFollowingBack.sort((a, b) => a.timestamp - b.timestamp);
      } else if (sort === "latest") {
        notFollowingBack.sort((a, b) => b.timestamp - a.timestamp);
      }

      res.json({
        total: notFollowingBack.length,
        notFollowingBack
      });

      // Cleanup temp files
      fs.unlinkSync(req.files.followers[0].path);
      fs.unlinkSync(req.files.following[0].path);

    } catch (err) {
      console.error(err);
      res.status(500).send("Error processing files");
    }
  }
);

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));