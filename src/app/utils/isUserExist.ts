import { userModel } from "../modules/User/user.model.ts"


export const isUserExist = async (email : string) => {
    const result = await userModel.findOne({email}).select('+password')
    return result 
}