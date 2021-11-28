const { Pool, Client } = require('pg')
const { RowDescriptionMessage } = require('pg-protocol/dist/messages')

const pool = new Pool({
    connectionString: 'postgres:// your',
    ssl: {
        rejectUnauthorized: false
    }
})


module.exports = {
    pool
}