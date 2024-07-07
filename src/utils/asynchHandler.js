const asynchHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => {
            next(err)
        })
    }

}

export { asynchHandler }