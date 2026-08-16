import type { TErrorSource, TGenericErrorResponse } from "../types/error.type.js"



const handleDuplicateError = (err : any) : TGenericErrorResponse => {
    const match = err.message.match(/"([^"]*)"/)
    const extractMassage = match && match[1]

    const errorSources : TErrorSource = [{
        path : '',
        message : `${extractMassage} is already exist.`
    }]

    return {
        statusCode : 400,
        message : 'Duplicate Error',
        errorSources
    }
}

export default handleDuplicateError