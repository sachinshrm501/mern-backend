import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"

const app=express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express({limit:"16kb"}))//server data send limit

app.use(express.urlencoded({extended:true,limit:"16kb"})) //URL remove like %20
app.use(express.static("public")) //set static public folder
app.use(cookieParser())

//Routes
import userRouter from './routes/user.routes.js'


//Routes declare
app.use("/api/v1/users", userRouter)
 
export {app}