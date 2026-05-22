import { HTTPException } from 'hono/http-exception';

export const NotFound = (msg: string) => new HTTPException(404, { message: msg });
export const BadRequest = (msg: string) => new HTTPException(400, { message: msg });
export const Unauthorized = (msg: string) => new HTTPException(401, { message: msg });
export const Forbidden = (msg: string) => new HTTPException(403, { message: msg });
export const Conflict = (msg: string) => new HTTPException(409, { message: msg });
