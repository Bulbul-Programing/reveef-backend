export const getCookingTime = (string : string) => {
    let matches = string.match(/(\d+)/)
    if (matches) {
        return Number(matches[0])
    }
    return null
}