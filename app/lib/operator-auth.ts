export function configuredOperatorValues(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function isConfiguredOperator(user: { userId: string; email: string }, values: { userIds?: string; emails?: string }) {
  return configuredOperatorValues(values.userIds).includes(user.userId)
    || configuredOperatorValues(values.emails).map((value) => value.toLowerCase()).includes(user.email.toLowerCase());
}
