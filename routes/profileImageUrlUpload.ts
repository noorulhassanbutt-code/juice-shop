import logger from '../lib/logger'
import path from 'path'

export function profileImageUrlUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {

    if (req.body.imageUrl !== undefined) {
      
      // Only allow a filename, not a URL from user input
      const filename = path.basename(req.body.imageUrl); 
      const allowedExt = ['jpg', 'jpeg', 'png', 'svg', 'gif'];
      const ext = filename.split('.').pop()?.toLowerCase();

      if (!ext || !allowedExt.includes(ext)) {
        return next(new Error('Invalid file type.'));
      }

      // Construct URL from safe server-owned location (not user input)
      const url = `https://yourTrustedCDN.com/uploads/${filename}`;

      const loggedInUser = security.authenticatedUsers.get(req.cookies.token);
      if (!loggedInUser) {
        return next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress));
      }

      try {
        const response = await fetch(url);

        if (!response.ok || !response.body) {
          throw new Error('Image not found on trusted source.');
        }

        const filepath = `frontend/dist/frontend/assets/public/images/uploads/${loggedInUser.data.id}.${ext}`;
        const fileStream = fs.createWriteStream(filepath, { flags: 'w' });

        await finished(Readable.fromWeb(response.body as any).pipe(fileStream));

        await UserModel.findByPk(loggedInUser.data.id)
          .then(user => user?.update({ profileImage: `/assets/public/images/uploads/${loggedInUser.data.id}.${ext}` }))
          .catch(error => next(error));

      } catch (error) {
        logger.warn(`Image fetch failed: ${error}`);
        return next(new Error("Could not set profile image"));
      }
    }

    res.redirect(`${process.env.BASE_PATH}/profile`);
  }
}
