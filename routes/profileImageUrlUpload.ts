import fs from 'node:fs'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { type Request, type Response, type NextFunction } from 'express'

import * as security from '../lib/insecurity'
import { UserModel } from '../models/user'
import * as utils from '../lib/utils'
import logger from '../lib/logger'

export function profileImageUrlUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {

    if (req.body.imageUrl !== undefined) {

      let url: URL;
      try {
        url = new URL(req.body.imageUrl) // Parse safely
      } catch {
        return res.status(400).send("INVALID_URL_FORMAT")
      }

      // ✅ Compliant: Only allow specific schemes and trusted domains
      const schemesList = ["http:", "https:"];
      const domainsList = ["images.myserver.com", "cdn.example.com"]; // trusted domains only

      if (!schemesList.includes(url.protocol) || !domainsList.includes(url.hostname)) {
        return res.status(400).send("UNSAFE_OR_UNTRUSTED_URL")
      }

      const loggedInUser = security.authenticatedUsers.get(req.cookies.token);
      if (!loggedInUser) {
        return next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress))
      }

      try {
        const response = await fetch(url.href);
        if (!response.ok || !response.body) {
          throw new Error('URL returned a non-OK status code or empty body');
        }

        const ext = ['jpg', 'jpeg', 'png', 'svg', 'gif'].includes(url.pathname.split('.').pop()?.toLowerCase() || '')
          ? url.pathname.split('.').pop()!.toLowerCase()
          : 'jpg';

        const filePath = `frontend/dist/frontend/assets/public/images/uploads/${loggedInUser.data.id}.${ext}`;
        const fileStream = fs.createWriteStream(filePath);

        await finished(Readable.fromWeb(response.body as any).pipe(fileStream));

        await UserModel.findByPk(loggedInUser.data.id)
          .then(user => user?.update({ profileImage: `/assets/public/images/uploads/${loggedInUser.data.id}.${ext}` }))
          .catch(err => next(err));

      } catch (error) {
        logger.warn(`Error retrieving profile image: ${utils.getErrorMessage(error)}`);
        return res.status(500).send("IMAGE_DOWNLOAD_ERROR")
      }
    }

    res.redirect(process.env.BASE_PATH + '/profile')
  }
}
