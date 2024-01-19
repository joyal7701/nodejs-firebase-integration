const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const functions = require("firebase-functions");
const app = express();
const port = 3000;

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://para-2dfbf.firebaseio.com",
  storageBucket: "gs://para-2dfbf.appspot.com",
});

const bucket = admin.storage().bucket();
const db = admin.firestore();

// Middleware setup
app.use(express.json({ limit: "50mb" }));
app.use(cors());

const path = require("path");

// Route to upload file to Firebase Storage
app.post("/upload", async (req, res) => {
  const { fileName, base64Data } = req.body;

  const fileBuffer = Buffer.from(base64Data, "base64");

  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  const fileExtension = path.extname(fileName).toLowerCase();

  // Check if the file extension is allowed
  if (allowedExtensions.includes(fileExtension)) {
    // Create a write stream to Firebase Storage
    const stream = bucket.file(fileName).createWriteStream({
      metadata: {
        contentType: `image/${fileExtension.slice(1)}`,
      },
    });

    // Handle stream events
    stream.on("error", (err) => {
      console.error(err);
      res.status(500).send("Error uploading file");
    });

    stream.on("finish", () => {
      res.status(200).send("File uploaded successfully");
    });

    // End the stream with file buffer
    stream.end(fileBuffer);
  } else {
    console.log("Invalid file extension. Only jpg, jpeg, and png are allowed.");
    res
      .status(400)
      .send("Invalid file extension. Only jpg, jpeg, and png are allowed.");
  }
});

// Route to list images in Firebase Storage
app.get("/listImages", async (req, res) => {
  try {
    // Get a list of files from Firebase Storage
    const [files] = await bucket.getFiles();

    // Filter image file names based on extensions
    const imageNames = files
      .filter(
        (file) =>
          file.name.toLowerCase().endsWith(".jpg") ||
          file.name.toLowerCase().endsWith(".jpeg") ||
          file.name.toLowerCase().endsWith(".png")
      )
      .map((file) => file.name);

    res.status(200).json(imageNames);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error listing images");
  }
});

// Route to download file from Firebase Storage
app.get("/download", async (req, res) => {
  const fileName = req.query.fileName;

  // Check if the file name is provided in the request
  if (!fileName) {
    return res.status(400).send("File name is missing in the request");
  }

  const file = bucket.file(fileName);
  const fileStream = file.createReadStream();

  // Handle stream events
  fileStream.on("error", (err) => {
    console.error(err);
    res.status(500).send("Error downloading file");
  });

  // Pipe the file stream to response
  fileStream.pipe(res);
});

// Route to delete image from Firebase Storage
app.delete("/deleteImage", async (req, res) => {
  const fileName = req.query.fileName;

  // Check if the file name is provided in the request
  if (!fileName) {
    return res.status(400).send("File name is missing in the request");
  }

  const file = bucket.file(fileName);

  // Delete the file from Firebase Storage
  file
    .delete()
    .then(() => {
      res.status(200).send("File deleted successfully");
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Error deleting file");
    });
});

// Route to create text record in Firestore
app.post("/createRecord", async (req, res) => {
  const { text } = req.body;

  try {
    // Add the text record to Firestore
    const docRef = await db.collection("textRecords").add({
      text: text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send("Text record created");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating text record");
  }
});

// Route to list text records from Firestore ordered by timestamp (newest first)
app.get("/listTextRecords", async (req, res) => {
  try {
    // Get text records from Firestore, ordered by timestamp
    const textRecordsSnapshot = await db
      .collection("textRecords")
      .orderBy("timestamp", "desc")
      .get();
    const textRecords = textRecordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      text: doc.data().text,
      timestamp: doc.data().timestamp.toDate(), // Convert timestamp to JavaScript Date object
    }));

    res.status(200).json(textRecords);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error listing text records");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

exports.app = functions.https.onRequest(app);
