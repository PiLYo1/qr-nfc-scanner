const express = require("express");
const fs = require("fs");
const http = require("http");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const { NFC } = require("nfc-pcsc");

const app = express();

// ✅ Enable CORS and serve static files (only once)
app.use(cors());
app.use(express.static("public"));

// ✅ Load SSL Certificates
const sslOptions = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

// ✅ Create both HTTP and HTTPS servers
const PORT = process.env.PORT || 4001;
const HTTPS_PORT = 4443;

const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// ✅ Initialize WebSocket (for both HTTP & HTTPS)
const io = socketIo(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ✅ Attach WebSocket to HTTPS as well
const ioSecure = socketIo(httpsServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ✅ Dummy profiles for testing
const profiles = {
    "123456789": { name: "John Doe", image: "/profiles/john.jpg" },
    "c2:7c:f9:cf": { name: "Jane Smith", image: "/profiles/jane.jpg" },
};

// ✅ NFC Integration (Handle Errors)
try {
    const nfc = new NFC();

    nfc.on("reader", (reader) => {
        console.log(`✅ NFC Reader detected: ${reader.name}`);

        reader.on("card", (card) => {
            const uid = card.uid;
            console.log(`🎉 NFC Scanned UID: ${uid}`);

            // ✅ Emit event for both HTTP & HTTPS clients
            io.emit("scanned", { uid, profile: profiles[uid] || null });
            ioSecure.emit("scanned", { uid, profile: profiles[uid] || null });
        });

        reader.on("error", (err) => {
            console.error("❌ NFC Reader Error:", err);
        });
    });

    nfc.on("error", (err) => {
        console.error("❌ NFC Error:", err);
    });
} catch (error) {
    console.error("⚠ NFC Module Error:", error.message);
}

// ✅ API Route to Fetch Profile by UID
app.get("/profile/:uid", (req, res) => {
    const profile = profiles[req.params.uid];
    if (profile) {
        res.json(profile);
    } else {
        res.status(404).json({ message: "Profile not found" });
    }
});

// ✅ Start HTTP server
httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log(`🔒 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
});

// ✅ Start HTTPS server (for Android & Web NFC)
httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
});