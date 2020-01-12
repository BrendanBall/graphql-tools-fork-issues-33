import {
  makeExecutableSchema,
  addMockFunctionsToSchema,
  mergeSchemas,
  delegateToSchema
} from 'graphql-tools-fork'
import { graphql, GraphQLList } from 'graphql'
import DataLoader from 'dataloader'

const taskSchema = makeExecutableSchema({
  typeDefs: `
    type Task {
      id: ID!
      text: String
      userId: ID!
    }

    type Query {
      task(id: ID!): Task
      tasks: [Task!]!
      taskByUserId(UserId: ID!): [Task!]!
    }
    `
})

addMockFunctionsToSchema({ schema: taskSchema })

const userSchema = makeExecutableSchema({
  typeDefs: `
    interface User {
      id: ID!
      email: String!
    }

    type Editor implements User {
      id: ID!
      email: String!
      name: String!
    }

    type Admin implements User {
      id: ID!
      email: String!
      godmode: Boolean!
    }

    type Query {
      userById(id: ID!): User
      usersByIds(ids: [ID!]!): [User]!
    }
  `
})

addMockFunctionsToSchema({ schema: userSchema })

const linkTypeDefs = `
  extend type Task {
    user: User!
  }
`

const resolvers = {
  Task: {
    user: {
      fragment: `... on Task { userId }`,
      resolve (task, args, context, info) {
        return context.loaders.users.load({ id: task.userId, info })
      }
    }
  }
}

export const schema = mergeSchemas({
  schemas: [
    taskSchema,
    userSchema
  ],
  typeDefs: linkTypeDefs,
  resolvers
})

function dataloaders () {
  return {
    users: new DataLoader(async keys => {
      const result = await delegateToSchema({
        schema: userSchema,
        operation: 'query',
        fieldName: 'usersByIds',
        args: {
          ids: keys.map(k => k.id)
        },
        context: null,
        info: {
          ...keys[0].info,
          returnType: new GraphQLList(keys[0].info.returnType) // magic happening here
        }
      })
      return [...result.slice(0, keys.length)] // necessary only in this example because mocking does not return the correct result length.
    })
  }
}

async function run () {
  const query = `{
    task(id: "1") {
      id
      text
      user {
        id
        email
      }
    }
  }`
  const result = await graphql(schema, query, null, { loaders: dataloaders() })
  console.log('result: %O', result)
}

run()
