export function profileImageUrlUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {

    if (req.body.imageUrl !== undefined) {

      let url: URL;

      try {
        url = new URL(req.body.imageUrl);   // Parse URL safely
      } catch {
        return res.status(400).send("INVALID_URL_FORMAT");
      }

      // Allowed protocols
      const allowedSchemes = ["http:", "https:"];

      // Allowed trusted domains only (modify as needed)
      const trustedDomains = ["images.myserver.com", "cdn.example.com"];

      // 🚫 Block URL if NOT trusted or protocol invalid
      if (!allowedSchemes.includes(url.protocol) || !trustedDomains.includes(url.hostname)) {
        return res.status(400).send("UNSAFE OR UNTRUSTED URL BLOCKED");
      }

      const loggedInUser = security.authenticatedUsers.get(req.cookies.token);
      if (!loggedInUser) {
        return next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress));
      }

      try {
        const response = await fetch(url.href);
        if (!response.ok || !response.body) throw new Error("URL returned invalid response");

        const ext = ['jpg','jpeg','png','svg','gif'].includes(url.pathname.split('.').pop()?.toLowerCase() || '')
          ? url.pathname.split('.').pop()!.toLowerCase()
          : 'jpg';

        const filePath = `frontend/dist/frontend/assets/public/images/uploads/${loggedInUser.data.id}.${ext}`;
        const fsStream = fs.createWriteStream(filePath);

        await finished(Readable.fromWeb(response.body as any).pipe(fsStream));

        await UserModel.findByPk(loggedInUser.data.id)
          .then(user => user?.update({ profileImage: `/assets/public/images/uploads/${loggedInUser.data.id}.${ext}` }))
          .catch(err => next(err));

      } catch (error) {
        logger.warn("Image fetch failed: " + utils.getErrorMessage(error));
        return res.status(500).send("IMAGE_DOWNLOAD_ERROR");
      }
    }

    res.redirect(process.env.BASE_PATH + '/profile');
  };
}
