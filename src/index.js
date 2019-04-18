const { json, send } = require('micro')
const mailcomposer = require('nodemailer/lib/mail-composer')
const {
  createClient: shipEngineClient
} = require('@particular./shipengine-request')
const { createClient: moltinClient } = require('@moltin/request')
const {
  createShipment,
  createShipmentLabel,
  startTracking
} = require('./utils')
const AWS = require('aws-sdk')
const SES = new AWS.SES({
  accessKeyId: process.env.AMAZON_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  region: process.env.AMAZON_REGION
})
const moltin = new moltinClient({
  client_id: process.env.MOLTIN_CLIENT_ID,
  client_secret: process.env.MOLTIN_CLIENT_SECRET,
  application: 'demo-sync-moltin-to-shipengine'
})
const shipEngine = new shipEngineClient({
  client_secret: process.env.SHIPENGINE_PRIVATE_KEY
})
const cors = require('micro-cors')({
  allowMethods: ['POST'],
  exposeHeaders: ['x-moltin-secret-key'],
  allowHeaders: [
    'x-moltin-secret-key',
    'x-forwarded-proto',
    'X-Requested-With',
    'Access-Control-Allow-Origin',
    'X-HTTP-Method-Override',
    'Content-Type',
    'Authorization',
    'Accept'
  ]
})

const _toJSON = error => {
  return !error
    ? ''
    : Object.getOwnPropertyNames(error).reduce(
        (jsonError, key) => {
          return { ...jsonError, [key]: error[key] }
        },
        { type: 'error' }
      )
}

const _toCamelcase = string => {
  return !string
    ? ''
    : string.replace(
        /\w\S*/g,
        word => `${word.charAt(0).toUpperCase()}${word.substr(1).toLowerCase()}`
      )
}

const _toLowercase = string => {
  return !string ? '' : string.toLocaleLowerCase()
}

process.on('unhandledRejection', (reason, p) => {
  console.error(
    'Promise unhandledRejection: ',
    p,
    ', reason:',
    JSON.stringify(reason)
  )
})

module.exports = cors(async (req, res) => {
  console.log('hi')
  if (req.method === 'OPTIONS') {
    return send(res, 204)
  }
  if (
    (await req.headers['x-moltin-secret-key']) !=
    process.env.MOLTIN_WEBHOOK_SECRET
  )
    return send(res, 401)

  try {
    const { triggered_by, resources: body } = await json(req)

    const {
      data: { type: observable, id: observable_id },
      included
    } = JSON.parse(body)

    const [type, trigger] = triggered_by.split('.') //type is 'order', trigger is `created`,`updated`,`fulfilled` or `paid`

    // console.log(`Shipping, type: ${JSON.stringify(type)}`)
    // console.log(`Shipping, observable: ${JSON.stringify(observable)}`)
    // console.log(`Shipping, observable_id: ${JSON.stringify(observable_id)}`)
    // console.log(`Shipping, included.items: ${JSON.stringify(included.items)}`)

    const shipping_item = included.items.find(orderItem =>
      _toLowercase(orderItem.name).startsWith('shipping')
    )
    // console.log(`Shipping, shipping_item: ${JSON.stringify(shipping_item)}`)

    if (
      type === 'order' &&
      observable === 'order' &&
      observable_id &&
      shipping_item
    ) {
      // just locking down to orders to protect code below
      const observed = await moltin.get(`${observable}s/${observable_id}`)
      // console.log(`Shipping, observed: ${JSON.stringify(observed)}`)
      // console.log(`Shipping, observed.data: ${JSON.stringify(observed.data)}`)

      const {
        data: {
          status: order_status,
          payment: payment_status,
          shipping: shipping_status,
          shipping_address,
          customer: { name: customer_name, email: customer_email },
          meta: {
            display_price: {
              with_tax: { formatted: total_paid }
            }
          },
          relationships: {
            customer: {
              data: { id: customer_id }
            }
          }
        }
      } = observed

      // console.log(`Shipping, customer_email: ${JSON.stringify(customer_email)}`)
      // console.log(`Shipping, payment_status: ${JSON.stringify(payment_status)}`)
      // console.log(`Shipping, shipping_status: ${JSON.stringify(shipping_status)}`)
      // console.log(`Shipping, shipping_address: ${JSON.stringify(shipping_address)}`)

      if (
        customer_email &&
        payment_status === 'paid' &&
        shipping_status !== 'fulfilled' &&
        shipping_item &&
        shipping_address
      ) {
        // console.log(`Shipping, rateId: ${shipping_item.sku}`)
        const [carrierId, serviceCode] = shipping_item.sku.split('--')
        console.log(`Shipping, carrierId: ${carrierId}`)
        console.log(`Shipping, serviceCode: ${serviceCode}`)

        return createShipment(
          shipEngine,
          carrierId,
          serviceCode,
          observable_id,
          shipping_address
        )
          .then(shipment => {
            console.log(`Shipping, shipment: ${JSON.stringify(shipment)}`)
            // this is where we may likely want a flow on the order object to add the shipment_id
            return createShipmentLabel(shipEngine, shipment.shipment_id)
              .then(label => {
                console.log(`Shipping, label: ${JSON.stringify(label)}`)
                // this is where we may likely want a flow on the order object to add the carrier_code and tracking_number
                return startTracking(
                  shipEngine,
                  label.carrier_code,
                  label.tracking_number
                ).then(() => {
                  console.log(
                    `Shipping, label.shipment_id: ${JSON.stringify(
                      label.shipment_id
                    )}`
                  )
                  // this is where we would want to email the warehouse w/ a shipping label and include a link to the label.shipment_id (and maybe send direct to the pickface printer?)

                  if (label.label_id) {
                    const { tracking_number, label_url } = label
                    const tracking_url = `https://www.google.com/search?q=${tracking_number}`

                    // const params = {
                    //   Destination: {
                    //     ToAddresses: [customer_email, 'adam@uniquelyparticular.com']
                    //   },
                    //   Message: {
                    //     Body: {
                    //       Html: {
                    //         Charset: 'UTF-8',
                    //         Data: `<html><body>Order ID: <a href="https://dashboard.moltin.com/app/orders/${observable_id}" target="_blank">${observable_id}</a><br/><br/>
                    //           Customer Name: ${customer_name}<br/>
                    //           Customer Email: ${customer_email}<br/><br/>
                    //           Shipping Information:<br/>
                    //           &nbsp;${shipping_address.company_name}<br/>
                    //           &nbsp;${shipping_address.first_name}&nbsp;${shipping_address.last_name}<br/>
                    //           &nbsp;${shipping_address.line_1}<br/>
                    //           ${(shipping_address.line_2)? `&nbsp;${shipping_address.line_2}<br/>`: ''}
                    //           &nbsp;${shipping_address.city},&nbsp;${shipping_address.county}&nbsp;${shipping_address.postcode}<br/>
                    //           ${(shipping_address.instructions)? `&nbsp;${shipping_address.instructions}<br/>`: ''}
                    //           <br/>Tracking Number: <a href="${tracking_url}" target="_blank">${tracking_number}</a><br/>
                    //           Shipping Label: <a href="${label_url}" target="_blank">${label_url}</a></body></html>`
                    //       },
                    //       Text: {
                    //         Charset: 'UTF-8',
                    //         Data: `Order ID: ${observable_id}\n${customer_name} (${customer_email})\nTracking Number: ${tracking_number}\n\nShipping Label: ${label_url}`
                    //       }
                    //     },
                    //     Subject: {
                    //       Charset: 'UTF-8',
                    //       Data: `Order: ${observable_id}`
                    //     }
                    //   },
                    //   Source: process.env.EMAIL_FROM
                    // }

                    // console.log(
                    //   `Shipping, params: ${JSON.stringify(params)}`
                    // )

                    const params = {
                      from: process.env.EMAIL_FROM,
                      to: process.env.EMAIL_FROM,
                      subject: `Order: ${observable_id}`,
                      text: `Order ID: ${observable_id}\n${customer_name} (${customer_email})\nTracking Number: ${tracking_number}\n\nShipping Label: ${label_url}`,
                      html: `<html><body>Order ID: <a href="https://dashboard.moltin.com/app/orders/${observable_id}" target="_blank">${observable_id}</a><br/><br/>
                                Customer Name: ${customer_name}<br/>
                                Customer Email: ${customer_email}<br/><br/>
                                Shipping Information:<br/>
                                &nbsp;${shipping_address.company_name}<br/>
                                &nbsp;${shipping_address.first_name}&nbsp;${
                        shipping_address.last_name
                      }<br/>
                                &nbsp;${shipping_address.line_1}<br/>
                                ${
                                  shipping_address.line_2
                                    ? `&nbsp;${shipping_address.line_2}<br/>`
                                    : ''
                                }
                                &nbsp;${shipping_address.city},&nbsp;${
                        shipping_address.county
                      }&nbsp;${shipping_address.postcode}<br/>
                                ${
                                  shipping_address.instructions
                                    ? `&nbsp;${
                                        shipping_address.instructions
                                      }<br/>`
                                    : ''
                                }
                                <br/>Tracking Number: <a href="${tracking_url}" target="_blank">${tracking_number}</a><br/>
                                Shipping Label: <a href="${label_url}" target="_blank">${label_url}</a><br/><br/></body></html>`,
                      attachments: [
                        {
                          filename: `order-${observable_id}.pdf`,
                          path: label_url
                        }
                      ]
                    }

                    console.log(`Shipping, params: ${JSON.stringify(params)}`)
                    const message = new mailcomposer(params).compile()

                    // return SES.sendEmail(params)
                    //   .promise()
                    return sendComposedEmail(SES, message)
                      .then(emailResponse => {
                        console.log(
                          `Shipping, emailResponse: ${JSON.stringify(
                            emailResponse
                          )}`
                        )
                        return send(
                          res,
                          200,
                          JSON.stringify({
                            received: true,
                            carrierId,
                            serviceCode,
                            trackingNumber: tracking_number
                          })
                        )
                      })
                      .catch(error => {
                        console.log('error sending email')
                        const jsonError = _toJSON(error)
                        return send(res, 500, jsonError)
                      })
                  } else {
                    console.log('missing label id')
                    const jsonError = _toJSON(labelResponse.messages)
                    return send(res, 500, jsonError || 'Error')
                  }
                })
              })
              .catch(error => {
                console.log('error creating shipping label')
                const jsonError = _toJSON(error)
                return send(res, 500, jsonError)
              })
          })
          .catch(error => {
            console.log('error creating shipment')
            const jsonError = _toJSON(error)
            return send(res, 500, jsonError)
          })
      } else {
        console.error('missing customer_email or sku (carrierId/serviceCode)')
        return send(
          res,
          200,
          JSON.stringify({ received: true, rateId: shipping_item.sku })
        )
      }
    } else {
      console.error('missing order_id')
      return send(res, 200, JSON.stringify({ received: true }))
    }
  } catch (error) {
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
})

const sendComposedEmail = (SES, message) => {
  return new Promise((resolve, reject) => {
    message.build((error, data) => {
      if (error) {
        reject(error)
      }
      SES.sendRawEmail({ RawMessage: { Data: data } })
        .promise()
        .then(resolve)
        .catch(reject)
    })
  })
}
