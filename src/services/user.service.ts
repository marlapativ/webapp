import User from '../models/user.model'
import logger from '../config/logger'
import { Ok, Result } from '../utils/result'
import validator from '../utils/validator'
import errors from '../utils/errors'
import crypto, { ICrypto } from '../config/crypto'
import httpContext, { IContext } from '../config/context'
import { publisherFactory } from '../config/publisher'
import env from '../config/env'
import Email from '../models/email.model'

/**
 * The user service interface
 */
export interface IUserService {
  /**
   * Create a user
   * @param user the user to create
   * @param skipEmailVerification whether to skip email verification or not
   * @returns the created user or error
   */
  createUser(user: User, skipEmailVerification?: boolean): Promise<Result<User, Error>>

  /**
   * Update a user
   * @param user the user to update
   * @returns the updated user or error
   */
  updateUser(user: User): Promise<Result<User, Error>>

  /**
   * Get the user
   * @returns the user or error
   */
  getUser(): Promise<Result<User, Error>>

  /**
   * Verify the email of a user on creation
   * @param email the email to verify
   * @param token the token to verify
   * @returns true if the email is verified, false otherwise
   */
  verifyEmail(email: string, token: string): Promise<Result<string, Error>>
}

/**
 * The user service
 */
export class UserService implements IUserService {
  crypto: ICrypto
  httpContext: IContext
  constructor(crypto: ICrypto, httpContext: IContext) {
    this.crypto = crypto
    this.httpContext = httpContext
  }

  async createUser(user: User, skipEmailVerification?: boolean): Promise<Result<User, Error>> {
    try {
      logger.info('Creating user')

      logger.debug('Create user - Field validation start')
      // Validate the user
      const validationError = await this.validateCreateUser(user)
      if (validationError) {
        logger.debug('Create user - Field validation error | Error: ' + validationError)
        return errors.validationError(validationError)
      }
      logger.debug('Create user - Field validation end')

      // Check if user with the given email already exists
      const username = user.username
      logger.debug('Create user - Validating if user with username already exists')
      const existingUser = await User.findOne({ where: { username } })
      if (existingUser) {
        logger.debug('Create user - Validation error | Error: Username already exists')
        return errors.validationError('User with this username already exists')
      }
      logger.debug('Create user - Validation end')

      logger.debug('Create user - Hashing password')
      // Hash the password
      const hashedPassword = await this.crypto.hashPassword(user.password)

      logger.info('Creating user in database')
      // Create the user model
      const newUser = new User({
        first_name: user.first_name,
        last_name: user.last_name,
        username,
        password: hashedPassword
      })

      logger.debug('Create user - Skipping email verification: ' + skipEmailVerification)
      // Skip email verification if not required
      if (skipEmailVerification) {
        logger.info('Create user - Skipped email verification')
        newUser.email_verified = true
      }

      logger.debug('Create user - Saving user to database')
      // Save the user to the database
      const savedUser = await newUser.save()
      logger.info('Created user with id: ' + savedUser.id)

      // Publish the user created event
      logger.debug('Create user - Publishing user created event')
      const topic = env.getOrDefault('PUBSUB_TOPIC', 'verify_email')

      logger.debug('Create user - Publish user created event skipped: ' + skipEmailVerification)
      if (!skipEmailVerification) {
        logger.info('Create user - Invoking publish user create event')
        const publishResult = await publisherFactory
          .get()
          .publish({ userId: savedUser.id, email: user.username }, topic)
        if (!publishResult.ok) {
          logger.error('Create user - Error publishing user created event', publishResult.error)
          return errors.internalServerError('Created User. Unable to send verify email.')
        }
        logger.debug('Create user - Published user created event')
      }
      return Ok(savedUser.toJSON() as User)
    } catch (error) {
      logger.error('Error creating user', error)
      return errors.internalServerError(`Error creating user: ${error}`)
    }
  }

  async updateUser(user: User): Promise<Result<User, Error>> {
    try {
      logger.info('Updating user')

      logger.debug('Update user - Field validation start')
      // Validate the user
      const validationError = await this.validateUpdateUser(user)
      if (validationError) {
        logger.debug('Update user - Field validation error | Error: ' + validationError)
        return errors.validationError(validationError)
      }
      logger.debug('Update user - Field validation end')

      // Find the user by user id from context
      const userId = this.httpContext.getUserIdFromContext()
      logger.info('Updating user with userId: ' + userId)

      logger.debug('Update user - Validating if user exists')
      const existingUser = await User.findByPk(userId)
      if (!existingUser) {
        logger.debug('Update user - Validation error | Error: User not found')
        return errors.notFoundError('User not found')
      }
      logger.debug('Update user - Validation end')

      logger.debug('Update user - Updating user details')
      // Update only allowed fields
      existingUser.first_name = user.first_name || existingUser.first_name
      existingUser.last_name = user.last_name || existingUser.last_name

      logger.debug('Update user - Hashing password if provided')
      // Hash the password if provided
      if (user.password) {
        const hashedPassword = await this.crypto.hashPassword(user.password)
        existingUser.password = hashedPassword
      }

      logger.debug('Update user - Saving user to database')
      // Save the updated user to the database
      const updatedUser = await existingUser.save()
      logger.info('Updated user with id: ' + updatedUser.id)
      return Ok(updatedUser.toJSON() as User)
    } catch (error) {
      logger.error('Error updating user', error)
      return errors.internalServerError(`Error updating user: ${error}`)
    }
  }

  async getUser(): Promise<Result<User, Error>> {
    try {
      logger.info('Fetching user details')

      logger.debug('Fetching user details from context')
      const loggedInUser = this.httpContext.getUserIdFromContext()

      logger.debug('Fetching user details from database for user: ' + loggedInUser)
      const user = await User.findByPk(loggedInUser)
      if (!user) {
        logger.info('User not found')
        return errors.notFoundError('User not found')
      }
      logger.info('Successfully fetched user details for userid: ' + loggedInUser)
      return Ok(user)
    } catch (error) {
      logger.error('Error fetching user', error)
      return errors.internalServerError(`Error fetching user: ${error}`)
    }
  }

  verifyEmail = async (email: string, token: string): Promise<Result<string, Error>> => {
    try {
      logger.info('Verifying user with email')

      if (!email || !token) {
        logger.info('Email or token not provided. Cannot verify email')
        return errors.validationError('Invalid link. Cannot verify email')
      }

      const currentDate = new Date()
      logger.debug('Fetching user details from database by email')
      const user = await User.findOne({ where: { username: email } })
      if (!user) {
        logger.info('User not found')
        return errors.notFoundError('User not found')
      }
      logger.info('Successfully fetched user details for userid: ' + user.id)

      if (user.email_verified) {
        logger.info('User email already verified')
        return Ok('Email verified')
      }

      logger.debug('Fetching user email verification details')
      const emailRecord = await Email.findOne({ where: { user_id: user.id, email_type: 'VERIFY' } })
      if (!emailRecord) {
        logger.info('Email record not found')
        return errors.notFoundError('Verification email not found')
      }

      logger.debug('Verification token and expiry found')
      if (emailRecord.auth_token !== token) {
        logger.info('Invalid link used for verification')
        return errors.forbiddenError('Invalid link used for verification')
      }

      // Adding expiry duration minutes to last email sent date
      const expiryDurationInMin = parseInt(env.getOrDefault('EMAIL_EXPIRY_MINUTES', '2'))
      const email_verification_sent_date = emailRecord.sent_date
      const expiry = new Date(email_verification_sent_date.getTime() + expiryDurationInMin * 60000)
      if (currentDate > expiry) {
        logger.info('Expired link used for verification')
        return errors.forbiddenError('Invalid/Expired link used for verification')
      }

      logger.info('Token verified for user ' + user.id)

      logger.debug('Updating user email verification status')
      user.email_verified = true
      await user.save()

      logger.info('Successfully verified email for user ' + user.id)
      return Ok('Email verified')
    } catch (error) {
      logger.error('Error verifying email for user', error)
      return errors.internalServerError(`Error fetching user: ${error}`)
    }
  }

  async validateCreateUser(user: User): Promise<string | null> {
    logger.debug('Validating create user field details')
    if (!user) return 'User details have to be defined'
    else if (!validator.isNullOrUndefined(user.id)) return 'id is not allowed'
    else if (!validator.isValidString(user.first_name)) return 'first_name is required and should be a string'
    else if (!validator.isValidString(user.last_name)) return 'last_name is required and should be a string'
    else if (!validator.isValidString(user.password)) return 'password is required and should be a string'
    else if (!validator.isValidString(user.username)) return 'username is required and should be a string'
    else if (!validator.isValidEmail(user.username)) return 'username is not a valid email address'
    else if (user.password.length < 8 || user.password.length > 50)
      return 'password should be at least 8 and at most 50 characters long'
    else if (user.first_name.length > 100 || user.last_name.length > 100)
      return 'first_name and last_name should be at most 100 characters long'
    const allowed_fields = ['first_name', 'last_name', 'password', 'username']
    for (const field in user) {
      if (!allowed_fields.includes(field)) {
        return `Field ${field} cannot be set during user creation`
      }
    }

    logger.debug('Validating create user model')
    try {
      const userModel = User.build({
        username: user.username,
        password: user.password,
        first_name: user.first_name,
        last_name: user.last_name
      })
      await userModel.validate()
      logger.debug('Create user field details validation successful')
    } catch (err) {
      logger.debug('Create user field details validation failed | Error: ' + err.message)
      return err.message
    }
    logger.debug('Validating create user successfully complete')
    return null
  }

  async validateUpdateUser(user: User): Promise<string | null> {
    logger.debug('Validating update user field details')
    if (!user) return 'User details have to be defined'
    const updatableFields = ['first_name', 'last_name', 'password']

    const update: Record<string, string> = {}
    for (const field in user) {
      if (!updatableFields.includes(field)) {
        return `Field ${field} cannot be updated`
      }
      const value = user[field as keyof User] as string
      if (!validator.isValidString(value)) {
        return `${field} cannot be empty and should be a string`
      }
      if (field === 'first_name' || field === 'last_name') {
        if (value.length > 100) {
          return `${field} should be at most 100 characters long`
        }
      }
      if (field === 'password' && (value.length < 8 || value.length > 50))
        return 'Password should be at least 8 and at most 50 characters long'
      update[field] = value
    }

    logger.debug('Validating update user model')
    try {
      const userModel = User.build(update)
      await userModel.validate({ fields: Object.keys(update) })
      logger.debug('Update user field details validation successful')
    } catch (err) {
      logger.debug('Update user field details validation failed | Error: ' + err.message)
      return err.message
    }
    logger.debug('Validating update user successfully complete')
    return null
  }
}

/**
 * The user service instance
 */
const userService: IUserService = new UserService(crypto, httpContext)

export default userService
