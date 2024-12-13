const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const URL =
  "mongodb+srv://siva15:admin123@cluster1.f0cox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1"; // Replace with your MongoDB connection URL

// 1. Create Mentor
app.post("/mentors", async (req, res) => {
  /**
   * 1.connect the DB server
   * 2.select the DB
   * 3.select the collection
   * 4.do the operation
   * 5.close the collection
   */
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const collection = db.collection("mentors");

    const mentor = { name: req.body.name, students: [] };
    const result = await collection.insertOne(mentor);

    const createdMentor = await collection.findOne({ _id: result.insertedId });
    connection.close();

    res.status(201).json({ createdMentor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating mentor" });
  }
});

// 2. Create Student
app.post("/students", async (req, res) => {
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const collection = db.collection("students");

    const student = { name: req.body.name, mentor: null, previousMentors: [] };
    const result = await collection.insertOne(student);

    const createdStudent = await collection.findOne({ _id: result.insertedId });
    connection.close();

    res.status(201).json({ createdStudent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating student" });
  }
});

// 3. Assign Students to Mentor
app.post("/mentors/:id/students", async (req, res) => {
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const mentorsCollection = db.collection("mentors");
    const studentsCollection = db.collection("students");

    const mentorId = req.params.id;
    const studentIds = req.body.studentIds; // Array of student IDs

    const mentor = await mentorsCollection.findOne({
      _id: new ObjectId(mentorId),
    });
    if (!mentor) {
      connection.close();
      return res.status(404).json({ message: "Mentor not found" });
    }

    for (let studentId of studentIds) {
      const student = await studentsCollection.findOne({
        _id: new ObjectId(studentId),
      });
      if (student && !student.mentor) {
        await studentsCollection.updateOne(
          { _id: student._id },
          {
            $set: { mentor: mentor._id },
            $push: { previousMentors: mentor._id },
          }
        );

        await mentorsCollection.updateOne(
          { _id: mentor._id },
          { $push: { students: student._id } }
        );
      }
    }

    const updatedMentor = await mentorsCollection.findOne({
      _id: new ObjectId(mentorId),
    });
    connection.close();

    res.status(200).json({ updatedMentor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning students" });
  }
});

// 4. Change Mentor for a Student
app.put("/students/:id/mentor", async (req, res) => {
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const mentorsCollection = db.collection("mentors");
    const studentsCollection = db.collection("students");

    const studentId = req.params.id;
    const newMentorId = req.body.mentorId;

    const student = await studentsCollection.findOne({
      _id: new ObjectId(studentId),
    });
    if (!student) {
      connection.close();
      return res.status(404).json({ message: "Student not found" });
    }

    const newMentor = await mentorsCollection.findOne({
      _id: new ObjectId(newMentorId),
    });
    if (!newMentor) {
      connection.close();
      return res.status(404).json({ message: "Mentor not found" });
    }

    if (student.mentor) {
      await mentorsCollection.updateOne(
        { _id: student.mentor },
        { $pull: { students: student._id } }
      );
    }

    await studentsCollection.updateOne(
      { _id: student._id },
      {
        $set: { mentor: newMentor._id },
        $push: { previousMentors: newMentor._id },
      }
    );

    await mentorsCollection.updateOne(
      { _id: newMentor._id },
      { $push: { students: student._id } }
    );

    const updatedStudent = await studentsCollection.findOne({
      _id: new ObjectId(studentId),
    });
    connection.close();

    res.status(200).json({ updatedStudent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error changing mentor" });
  }
});

// 5. Get All Students for a Mentor
app.get("/mentors/:id/students", async (req, res) => {
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const mentorsCollection = db.collection("mentors");
    const studentsCollection = db.collection("students");

    const mentorId = req.params.id;
    const mentor = await mentorsCollection.findOne({
      _id: new ObjectId(mentorId),
    });

    if (!mentor) {
      connection.close();
      return res.status(404).json({ message: "Mentor not found" });
    }

    const students = await studentsCollection
      .find({ _id: { $in: mentor.students } })
      .toArray();

    connection.close();
    res.status(200).json({ students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching students" });
  }
});

// 6. Get Previously Assigned Mentors for a Student
app.get("/students/:id/mentors", async (req, res) => {
  try {
    const connection = new MongoClient(URL);
    await connection.connect();
    const db = connection.db("mentorStudentDB");
    const mentorsCollection = db.collection("mentors");
    const studentsCollection = db.collection("students");

    const studentId = req.params.id;
    const student = await studentsCollection.findOne({
      _id: new ObjectId(studentId),
    });

    if (!student) {
      connection.close();
      return res.status(404).json({ message: "Student not found" });
    }

    const previousMentors = await mentorsCollection
      .find({ _id: { $in: student.previousMentors } })
      .toArray();

    connection.close();
    res.status(200).json({ previousMentors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching previous mentors" });
  }
});

// Start the Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
