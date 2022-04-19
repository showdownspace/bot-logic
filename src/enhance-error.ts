export function enhanceError(extraMessage: string) {
  return function (error: any) {
    if (error.message) {
      error.message = `${extraMessage}: ${error.message}`
    }
    if (error.stack) {
      error.stack = `${extraMessage}: ${error.stack}`
    }
    throw error
  }
}
