type Request = {
  method?: string;
};

type Response = {
  set: (header: string, value: string) => void;
  status: (code: number) => {
    send: (body: unknown) => void;
  };
};

export const helloHttp = (req: Request, res: Response): void => {
  res.set("content-type", "application/json");
  res.status(200).send({
    message: "check-mail backend is alive",
    method: req.method ?? "UNKNOWN",
  });
};
