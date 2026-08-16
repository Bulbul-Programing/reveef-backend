import { ZodError, type ZodIssue } from "zod";
import type { TErrorSource, TGenericErrorResponse } from "../types/error.type.js";

const handleZodError = (err: ZodError): TGenericErrorResponse => {
    const statusCode = 400
    const errorSources: TErrorSource = err.issues.map((issue: ZodIssue) => {
        return {
            path: issue.path[issue.path.length - 1] as string,
            message: issue.message
        }
    })
    const message = err?.issues[0]?.message || 'Zod Validation Error'
    return {
        statusCode,
        message,
        errorSources
    }
}

export default handleZodError