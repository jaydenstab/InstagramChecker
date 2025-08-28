const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3000;

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Helper: extract users from JSON
function extractUsers(json) {
  const list = Array.isArray(json)
    ? json
    : json.relationships_following || json.relationships_followers || [];
  if (!Array.isArray(list)) return [];

  return list
    .map(entry => {
      const data = entry.string_list_data?.[0];
      if (!data || !data.value) return null;
      return { value: data.value, timestamp: data.timestamp || 0 };
    })
    .filter(Boolean);
}

// Main upload endpoint
app.post("/upload", upload.fields([
  { name: "followers" },
  { name: "following" }
]), (req, res) => {
  const accountType = req.body.accountType;

  if (accountType === "private") {
    try {
      // Read uploaded JSON files
      const followersRaw = JSON.parse(fs.readFileSync(req.files.followers[0].path, "utf8"));
      const followingRaw = JSON.parse(fs.readFileSync(req.files.following[0].path, "utf8"));

      const followers = extractUsers(followersRaw);
      const following = extractUsers(followingRaw);

      // Find users not following back
      let notFollowingBack = following.filter(f =>
        !followers.some(fl => fl.value.toLowerCase() === f.value.toLowerCase())
      );

      // Sorting
      const sort = req.query.sort;
      if (sort === "asc") notFollowingBack.sort((a,b)=>a.value.localeCompare(b.value));
      else if (sort === "desc") notFollowingBack.sort((a,b)=>b.value.localeCompare(a.value));
      else if (sort === "earliest") notFollowingBack.sort((a,b)=>a.timestamp - b.timestamp);
      else if (sort === "latest") notFollowingBack.sort((a,b)=>b.timestamp - a.timestamp);

      res.json({
        total: notFollowingBack.length,
        notFollowingBack,
        followersCount: followers.length,
        followingCount: following.length
      });

      // Cleanup
      fs.unlinkSync(req.files.followers[0].path);
      fs.unlinkSync(req.files.following[0].path);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error processing JSON files" });
    }

  } else if (accountType === "public") {
    const username = req.body.username?.trim();
    if (!username) {
      return res.status(400).json({ error: "Username required for public accounts" });
    }

    // Placeholder for live fetch logic; currently returns dummy values
    // Later you can integrate Instagram scraping or API fetching here
    const followers = []; // populate with real data
    const following = []; // populate with real data
    const notFollowingBack = []; // compute

    res.json({
      total: notFollowingBack.length,
      notFollowingBack,
      followersCount: followers.length,
      followingCount: following.length
    });

  } else {
    res.status(400).json({ error: "Invalid account type" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));