import fs from "fs";
import path from "path";
import express from "express";
import multer from "multer";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, "build")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "build/index.html"));
});

// Helper: extract users from uploaded JSON
function extractUsers(json) {
  const list = Array.isArray(json)
    ? json
    : json.relationships_following || json.relationships_followers || [];
  if (!Array.isArray(list)) return [];

  return list
    .map(entry => {
      const data = entry.string_list_data?.[0];
      if (!data || !data.value) return null;
      return {
        value: data.value,
        href: data.href || `https://www.instagram.com/${data.value}/`,
        timestamp: data.timestamp || 0
      };
    })
    .filter(Boolean);
}

// Compute users not following back
function computeNotFollowingBack(followers, following) {
  return following.filter(f =>
    !followers.some(fl => fl.value.toLowerCase() === f.value.toLowerCase())
  );
}

// Main upload endpoint
app.post("/upload", upload.fields([
  { name: "followers" },
  { name: "following" }
]), async (req, res) => {
  const accountType = req.body.accountType;

  // --- PRIVATE ACCOUNT LOGIC ---
  if (accountType === "private") {
    try {
      const followersRaw = JSON.parse(fs.readFileSync(req.files.followers[0].path, "utf8"));
      const followingRaw = JSON.parse(fs.readFileSync(req.files.following[0].path, "utf8"));

      const followers = extractUsers(followersRaw);
      const following = extractUsers(followingRaw);

      let notFollowingBack = computeNotFollowingBack(followers, following);

      // Optional sorting
      const sort = req.query.sort;
      if (sort === "asc") notFollowingBack.sort((a,b) => a.value.localeCompare(b.value));
      else if (sort === "desc") notFollowingBack.sort((a,b) => b.value.localeCompare(a.value));
      else if (sort === "earliest") notFollowingBack.sort((a,b) => a.timestamp - b.timestamp);
      else if (sort === "latest") notFollowingBack.sort((a,b) => b.timestamp - a.timestamp);

      res.json({
        total: notFollowingBack.length,
        notFollowingBack,
        followersCount: followers.length,
        followingCount: following.length
      });

      fs.unlinkSync(req.files.followers[0].path);
      fs.unlinkSync(req.files.following[0].path);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error processing JSON files" });
    }

  // --- PUBLIC ACCOUNT LOGIC (PAUSED) ---
  } else if (accountType === "public") {
    res.status(400).json({
      error: "Public account scraping is temporarily disabled due to Instagram anti-automation measures. Please use the private account option with JSON files for accurate results."
    });
  } else {
    res.status(400).json({ error: "Invalid account type" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));