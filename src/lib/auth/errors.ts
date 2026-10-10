/** Thrown by the auth helpers; handleApiError turns these into 401/403/404/429 responses. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Please sign in.", "unauthorized");
export const noHousehold = () => new HttpError(403, "Create or join a household first.", "no_household");
export const forbidden = (message = "Only a household owner can do that.") => new HttpError(403, message, "forbidden");
/** Used for any row that doesn't exist *or* belongs to another household -- never reveal which. */
export const notFound = (message = "Not found") => new HttpError(404, message, "not_found");
export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);
