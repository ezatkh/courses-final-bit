const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");
let session = require("express-session");

router.get("/:roll/:email", async function (req, res) {
  let user;

  if (req.params.roll == "Student")
    user = await Student.findOne({ Email: req.params.email });
  else user = await Teacher.findOne({ Email: req.params.email });

  if (!user) res.status(404);
  else {
    req.session.email = user.Email;
    req.session.roll = req.params.roll;
    req.session.Name = user.Name;
    req.session.save();
    session = req.session;
  }
  res.send(user);
});
router.post("/user", function (req, res) {
  const userInfo = req.body;
  Student.findOne({ Email: userInfo.Email }).exec(function (err, user) {
    if (user == null) {
      const newStudent = new Student({
        Name: userInfo.Name,
        Email: userInfo.Email,
        Password: userInfo.Password,
        NumOfHours: 0,
        IMG: "",
        Gender: userInfo.Gender,
      });
      newStudent.save();
      req.session.email = newStudent.Email;
      req.session.roll = "Student";
      req.session.Name = userInfo.Name;
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
  if (req.session.roll == "Student") {
    Student.findOne({ Email: req.session.email })
      .populate("Courses")
      .exec(function (err, user) {
        res.send(user.Courses);
      });
  } else {
    Teacher.findOne({ Email: req.session.email })
      .populate("Courses")
      .exec(function (err, user) {
        res.send(user.Courses);
      });
  }
});

router.post("/courses", async function (request, response) {
  const teacherEmail = request.session.email;

  const courseBody = request.body;
  Teacher.findOne({ email: teacherEmail }).exec(function (err, t) {
    let newCourse = new Course({
      Name: courseBody.name,
      Teacher: request.session.Name,
      CreditHours: courseBody.creditHours,
      Time: courseBody.time,
      Days: courseBody.days,
      Status: "in progress",
      FinalGrade: 0,
      numOfStudents: 0,
    });

    let ok = true;
    let p = Teacher.findOne({ email: teacherEmail })
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
        }
      });
    if (!ok) response.status(409);

    response.end();
  });
});

router.put("/courses", function (request, response) {
  const courseToAdd = request.body.courseId;
  const StudentEmail = request.session.email;
  Student.findOne({ Email: StudentEmail }).exec(function (err, student) {
    Course.findOne({ _id: courseToAdd }).exec(function (err, course) {
      course.numOfStudents++;
      student.courses.push(course);
      course.Students.push(student);
      course.save();
      student.save();
      response.end();
    });
  });
});
router.get("/logout", function (req, res) {
  session = req.session;
  res.end();
});
router.get("/active", function (req, res) {
  if (session.email) console.log("logged in");
  else console.log("not logged in");
  res.end();
});

module.exports = router;
