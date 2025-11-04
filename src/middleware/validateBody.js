export const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res
            .status(400)
            .json({ error: result.error.issues.map((i) => i.message) });
    }
    req.validatedBody = result.data;
    next();
};
