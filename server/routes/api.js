const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
let session = require("express-session");
const multer = require("multer");
require("dotenv").config();
const stripe = require("stripe")(
  "sk_test_51LeGicIN52kFR3FiN1OPFopdZskt2nXufaDViHe3FHPFZ4MG2kVX8Ctv9ipnkrXuUJf6lONs1hsorLldRg9crGJ300yLaWEVBY"
);

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".jpg");
  },
});
var storageFile = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".pdf");
  },
});
var uploadFile = multer({ storage: storageFile });
var upload = multer({ storage: storage });

router.post("/upload_file", upload.array("myFile"), function (req, res) {
  if (session.roll == "Student") {
    Student.findOne({ Email: session.email }).exec(function (err, student) {
      student.IMG = req.files[0];
      student.save();
    });
  } else {
    Teacher.findOne({ Email: session.email }).exec(function (err, teacher) {
      teacher.IMG = req.files[0];
      teacher.save();
    });
  }
  res.json({ message: "Successfully uploaded files" });
  res.end();
});

router.post(
  "/pdf_file/:courseId",
  uploadFile.array("PDF_FILE"),
  function (req, res) {
    let courseID = req.params.courseId;
    Course.findOne({ _id: courseID }).exec(function (err, course) {
      course.File = req.files[0];
      course.save();
    });
    res.json({ message: "Successfully uploaded a PDF file" });
    res.end();
  }
);

router.get("/:roll/:email/:pass", async function (req, res) {
  let user;

  if (req.params.roll == "Student")
    user = await Student.findOne({
      Email: req.params.email,
      Password: req.params.pass,
    });
  else
    user = await Teacher.findOne({
      Email: req.params.email,
      Password: req.params.pass,
    });

  if (!user) res.status(404);
  else {
    req.session.email = user.Email;
    req.session.roll = req.params.roll;
    req.session.Name = user.Name;
    req.session.wallet = user.Wallet;
    req.session.save();
    session = req.session;
  }

  res.send();
});

router.post("/user", function (req, res) {
  const userInfo = req.body;

  Student.findOne({ Email: userInfo.Email }).exec(function (err, user) {
    if (user == null) {
      const newStudent = new Student({
        Name: userInfo.Name,
        Email: userInfo.Email,
        Password: userInfo.Password,
        IMG: null,
        Gender: userInfo.Gender,
        Wallet: 0,
      });
      newStudent.save();
      req.session.email = newStudent.Email;
      req.session.roll = "Student";
      req.session.Name = userInfo.Name;
      req.session.wallet = 0;
      req.session.save();

      res.send();
    } else {
      res.status(409).send({
        Error: "The email address you entered is already existed",
      });
    }
  });
});

router.get("/courses", function (req, res) {
  if (session.roll == "Student") {
    Student.findOne({ Email: session.email })
      .populate({
        path: "Courses",
        populate: {
          path: "Teacher",
        },
      })
      .exec(function (err, user) {
        res.send(user.Courses);
      });
  } else {
    Teacher.findOne({ Email: session.email })
      .populate("Courses")
      .exec(function (err, user) {
        res.send(user.Courses);
      });
  }
});

router.get("/searchCourses", function (request, response) {
  let query = request.query;
  if (query.teacherName) {
    Teacher.find({ Name: query.teacherName })
      .populate("Courses")
      .exec(function (err, user) {
        response.send(user[0].Courses);
      });
  } else if (query.courseName) {
    Course.find({ Name: query.courseName })
      .populate("Teacher")
      .exec(function (err, courses) {
        response.send(courses);
      });
  } else {
    Course.find({})
      .populate("Teacher")
      .exec(function (err, courses) {
        response.send(courses);
      });
  }
});

router.post("/courses", async function (request, response) {
  const teacherEmail = session.email;
  const courseBody = request.body;
  Teacher.findOne({ Email: teacherEmail }).exec(async function (err, t) {
    let newCourse = new Course({
      Name: courseBody.name,
      Teacher: t._id,
      CreditHours: courseBody.creditHours,
      Time: courseBody.time,
      Days: courseBody.days,
      Status: "in progress",
      FinalGrade: 0,
      numOfStudents: 0,
      Students: [],
      File: null,
    });

    let ok = true;
    await Teacher.findOne({ Email: teacherEmail })
      .populate("Courses")
      .exec(function (error, teacher) {
        teacher.Courses.forEach((course) => {
          if (course.Time == newCourse.Time && course.Days == newCourse.Days) {
            ok = false;
          }
        });
        if (ok) {
          teacher.Courses.push(newCourse);
          teacher.save();
          newCourse.save();
          response.send();
        } else {
          response.status(409);
          response.send();
        }
      });
  });
});
router.get("/logout", function (req, res) {
  session = req.session;

  session = undefined;

  res.end();
});

router.delete("/course/:courseid", function (req, res) {
  let courseToDel = req.params.courseid;
  let isItOkeyToDelete = "yes";
  if (session.roll == "Teacher") {
    Course.findOne({ _id: courseToDel, numOfStudents: 0 }).exec(function (
      err,
      course
    ) {
      if (course != null) {
        course.delete();

        Teacher.findOne({ Email: session.email }).exec(function (err, teacher) {
          teacher.Courses.map((c, index) => {
            if (c._id == courseToDel) {
              teacher.Courses.splice(index, 1);
              teacher.save();
            }
          });
        });
      }
    });
    /*
    Course.forEach((c) => {
      console.log(c);
      if (c._id == courseToDel) {
        if (c.numOfStudents > 0) {
          res.send({ ok: "no" });
        }
        c.remove();
        c.save();
        console.log("found it");
      }
    });
    */
  } else {
    Student.findOne({ Email: session.email }).exec(function (err, student) {
      student.Courses.map((c, index) => {
        if (c._id == courseToDel) {
          student.Courses.splice(index, 1);
          student.save();
        }
      });
    });
  }
  res.end();
});

router.put("/course", function (request, response) {
  const courseToAdd = request.body.courseId;
  const StudentEmail = session.email;
  Student.findOne({ Email: StudentEmail }).exec(function (err, student) {
    Course.findOne({ _id: courseToAdd }).exec(function (err, course) {
      if (student && course) {
        course.numOfStudents++;
        student.Courses.push(course);
        course.Students.push(student);
        course.save();
        student.save();
        response.end();
      }
    });
  });
});

router.get("/userinfo", function (req, res) {
  if (session.email) {
    let email = session.email;
    if (session.roll == "Student") {
      Student.findOne({ Email: email }).exec(function (err, student) {
        if (student) {
          let userInfo = {
            email: session != undefined ? session.email : undefined,
          };
          userInfo.roll = "Student";
          userInfo.name = student.Name;
          userInfo.gender = student.Gender;
          userInfo.img = student.IMG;
          userInfo.wallet = student.Wallet;
          res.send(userInfo);
        }
      });
    } else {
      Teacher.findOne({ Email: email }).exec(function (err, teacher) {
        if (teacher) {
          let userInfo = {
            email: session != undefined ? session.email : undefined,
          };
          userInfo.roll = "Teacher";
          userInfo.name = teacher.Name;
          userInfo.gender = teacher.Gender;
          userInfo.img = teacher.IMG;
          res.send(userInfo);
        }
      });
    }
  }
});

router.delete("/courseStudent/:courseId", function (request, response) {
  const studentEmail = session.email;
  const courseID = request.params.courseId;
  Student.findOne({ Email: studentEmail }).exec(function (err, student) {
    Course.findOne({ _id: courseID }).exec(function (err, course) {
      course.Students.forEach((s, index) => {
        if (s._id == student._id) {
          course.Students.splice(index, 1);
          course.save();
        }
      });
    });
    student.Courses.forEach((c, index) => {
      if (courseID == c._id) {
        student.Courses.splice(index, 1);
        student.save();
      }
    });
    response.send(student.Courses);
  });
});

router.get("/sessionInfo", function (req, res) {
  let info = undefined;
  if (session != undefined)
    info = { email: session.email, roll: session.roll, wallet: session.wallet };
  res.send(info);
});
router.post("/payment", async (req, res) => {
  let { amount, id } = req.body;

  const info = {
    amount: amount,
    currency: "USD",
    description: "American University",
    payment_method: id,
    confirm: true,
  };
  const payment = await stripe.paymentIntents.create(info);

  try {
    Student.findOne({ Email: session.email }).exec(function (err, student) {
      if (student) {
        student.Wallet += info.amount;
        student.save();
      }
    });
    const payment = await stripe.paymentIntents.create({
      currency: "USD",
      description: "American University",
      payment_method: id,
      transfer_data: 50,
      confirm: true,
    });

    res.json({
      message: "Payment successful",
      success: true,
    });
  } catch (error) {
    res.json({
      message: "Payment failed",
      success: false,
    });
  }
  res.end();
});

router.put("/user", function (req, res) {
  let pass = req.body.pass;
  if (session.roll == "Stuent") {
    Student.findOne({ Email: session.email }).exec(function (err, student) {
      student.Password = pass;
      student.save();
    });
  } else {
    Teacher.findOne({ Email: session.email }).exec(function (err, teacher) {
      teacher.Password = pass;
      teacher.save();
    });
  }
  res.end();
});

router.post("/exam", function (request, respnse) {
  let examBody = request.body;
  let idCourse = examBody.courseId;
  newExam = new Exam({
    isClosed: true,
    isFree: true,
    Questions: [],
    Course: examBody.courseId,
    Name: examBody.Name,
  });

  Course.findOne({ _id: idCourse }).exec(function (err, course) {
    course.Exams = newExam;
    course.save();
  });
  newExam.save();
  respnse.end();
});
router.delete("/exam/:courseId", function (req, res) {
  let idCourse = req.params.courseId;

  Course.findOne({ _id: idCourse })
    .populate("Exams")
    .exec(function (err, course) {
      Exam.findOne({ _id: course.Exams._id }).exec(function (err, exam) {
        exam.remove();
        exam.save();
      });
      course.Exams = null;
      course.save();

      res.end();
    });
});
router.post("/question", function (request, respnse) {
  let bodyExam = request.body;
  let courseId = bodyExam.courseId;
  Course.findOne({ _id: courseId })
    .populate("Exams")
    .exec(function (err, course) {
      let examId = course.Exams._id;
      let newQuestion = new Question({
        question: bodyExam.question,
        choices: bodyExam.choices,
        answer: bodyExam.answer,
        isMultiple: bodyExam.isMultiple,
        exam: examId,
      });

      Exam.findOne({ _id: examId }).exec(function (err, exam) {
        exam.Questions.push(newQuestion);
        exam.save();
      });
      newQuestion.save();
    });

  respnse.end();
});

router.put("/user", function (req, res) {
  let pass = req.body.pass;
  if (session.roll == "Student") {
    Student.findOne({ Email: session.email }).exec(function (err, student) {
      student.Password = pass;
      student.save();
    });
  } else {
    Teacher.findOne({ Email: session.email }).exec(function (err, teacher) {
      teacher.Password = pass;
      teacher.save();
    });
  }
  res.end();
});

router.put("/changeBalance", function (req, res) {
  let amount = req.body.amount;
  let balance;
  Student.findOne({ Email: session.email }).exec(async function (err, student) {
    student.Wallet += amount;
    balance = student.Wallet;
    await student.save();

    res.send({ balance: balance });
  });
});

router.put("/aboutToMakeATransaction", function (req, res) {
  session.valueToBeAded = req.body.amount;
  res.end();
});

router.put("/confirmTransaction", function (req, res) {
  Student.findOne({ Email: session.email }).exec(async function (err, student) {
    if (student) {
      student.Wallet += session.valueToBeAded;
      await student.save();
      res.end();
    }
  });
});
router.get("/exam/:courseId", function (req, res) {
  let idCourse = req.params.courseId;
  Course.findOne({ _id: idCourse })
    .populate({
      path: "Exams",
      populate: {
        path: "Questions",
      },
    })
    .exec(function (err, course) {
      res.send(course.Exams);
    });
});

router.get("/courseStudents/:courseId", function (req, res) {
  let allstudents = [];
  let courseId = req.params.courseId;
  Course.findOne({ _id: courseId })
    .populate("Students")
    .exec(function (err, course) {
      course.Students.forEach((S) => {
        let newStudent = {
          name: S.Name,

          img: S.IMG == null ? S.IMG : S.IMG.path.substring(8),

          email: S.Email,
        };
        allstudents.push(newStudent);
      });
      res.send(allstudents);
    });
});
router.put("/grade", function (req, res) {
  let gradeStatus = req.body.status;
  let courseId = req.body.courseId;
  Student.findOne({ Email: session.email })
    .populate("Courses")
    .exec(function (err, student) {
      student.Courses.map((course) => {
        if (course._id == courseId) {
          course.FinalGrade = gradeStatus;
          course.Status = "past";
          course.save();
        }
      });
    });
});
router.put("/openExam", function (req, res) {
  let status = req.body;
  Teacher.findOne({ Email: session.email })
    .populate({
      path: "Courses",
      populate: {
        path: "Exams",
      },
    })
    .exec(function (err, teacher) {
      teacher.Courses.map((course) => {
        if (course._id == status.courseId) {
          let status = course.Exams.isClosed;
          course.Exams.isClosed = !status;
          course.Exams.save();
          teacher.save();
          course.save();
        }
      });
    });
  res.end();
});
module.exports = router;
