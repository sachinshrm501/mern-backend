import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating refresh and access token')

    }
}


const registerUser = asyncHandler(async (req, res) => {
    //Get user details from frontend
    //Validation --not empty
    //Check if user already exist : username,email
    //Check for images,check for avatar
    //Upload for the cloudbery :check for avatar
    //create user object ,save in db
    //remove password and refresh token field from response
    //check for user creation 
    // return res

    const { fullname, email, username, password } = req.body;
    console.log("email :", email);

    //    if(fullname===""){ //this is single check process
    //     throw new ApiError(400,"fullName is required")
    //    }
    if ([fullname, email, username, password].some((field) =>
        field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with Username and email already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(408, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(408, "Avatar is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
        email,
        username: username.toLowerCase()

    })
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, "Something wrong well when registring")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered success")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    //req body->data
    //username or email
    //find the user
    //password check
    //access and refresh token generate
    //send cookie

    const { email, username, password } = req.body
    if (!username && !email) {
        throw new ApiError(400, 'Username and password required')
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User not registered")
    }

    const ispasswordValid = await user.isPasswordCorrect(password)
    if (!ispasswordValid) {
        throw new ApiError(401, "Invalid user crendial")
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const logInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200).cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: logInUser, accessToken, refreshToken
                },
                "User login user success"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unautherized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid request token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or expired")
        }

        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "access token refres success"
                )
            )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }






})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
}