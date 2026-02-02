import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(1),
  })
)

export const changePasswordValidator = vine.compile(
  vine.object({
    current_password: vine.string().minLength(1),
    new_password: vine.string().minLength(8),
    new_password_confirmation: vine.string().minLength(8),
  })
)

export const onboardingValidator = vine.compile(
  vine.object({
    timezone: vine.string().trim().minLength(1),
  })
)
