import bcrypt from 'bcryptjs';

export const isPasswordMatched = async(plainPassword : string, hasPassword : string) => {
    return await bcrypt.compare(plainPassword, hasPassword)
}