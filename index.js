const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }

  //bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("DocHere server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wy87kp4.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client
      .db("docHereDB")
      .collection("usersCollection");
    const doctorsCollection = client
      .db("docHereDB")
      .collection("doctorsCollection");
    const bookingCollection = client
      .db("docHereDB")
      .collection("bookingCollection");

    //jwt api   //token issue in backend done
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });


    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(401).send({error: true, message: 'forbidden message'})
      }
      next();
    }


    //users related API
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "User exists in database" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyJWT,  async(req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        res.send({admin: false})
      }

      const query = {email : email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role  === 'admin'}
      res.send(result);
    })


    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //doctors related API
    app.get("/doctors", async (req, res) => {
      const result = await doctorsCollection.find().toArray();
      res.send(result);
    });

    app.get("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.findOne(query);
      res.send(result);
    });


    app.post('/doctors',verifyJWT, verifyAdmin,  async(req, res) => {
      const newDoctor = req.body;
      const result = await doctorsCollection.insertOne(newDoctor);
      res.send(result)
    })



    //booked appointment related API
    app.post("/bookedAppointments", verifyJWT,  async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookedAppointments", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }

      const query = { patientEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(port);
});
