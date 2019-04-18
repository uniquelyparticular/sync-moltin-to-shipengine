const createShipment = (
  shipEngine,
  carrierId,
  serviceCode,
  orderId,
  shippingAddress,
  shippingParcels = [_defaultParcel],
  shipFromAddress = _defaultFromAddress
) => {
  return new Promise((resolve, reject) => {
    const payload = {
      shipment: {
        validate_address: 'no_validation',
        ship_to: _transformAddress(shippingAddress),
        ship_from: _transformAddress(shipFromAddress),
        packages: _transformParcels(shippingParcels)
      }
    }

    payload.shipment.carrier_id = carrierId
    payload.shipment.service_code = serviceCode
    payload.shipment.external_shipment_id = orderId

    const shipmentPayload = {
      shipments: [payload.shipment]
    }
    console.log('createShipment, shipmentPayload', shipmentPayload)

    return shipEngine
      .post('shipments', shipmentPayload)
      .then(data => {
        const {
          shipment_id,
          external_shipment_id,
          carrier_id,
          service_code,
          created_at,
          ship_date
        } = data.shipments[0]
        resolve({
          shipment_id,
          external_shipment_id,
          carrier_id,
          service_code,
          created_at,
          ship_date
        })
      })
      .catch(error => reject(error))
  })
}

const createShipmentLabel = (shipEngine, shipmentId) => {
  return new Promise((resolve, reject) => {
    const labelPayload = {
      test_label: true,
      label_format: 'pdf'
    }

    return shipEngine
      .post(`labels/shipment/${shipmentId}`, labelPayload)
      .then(data => {
        console.log('createShipmentLabel, data', data)
        const {
          label_id,
          shipment_id,
          carrier_code,
          tracking_number,
          label_download: { href: label_url }
        } = data
        resolve({
          label_id,
          shipment_id,
          carrier_code,
          tracking_number,
          label_url
        })
      })
      .catch(error => reject(error))
  })
}

const startTracking = (shipEngine, carrierCode, trackingNumber) => {
  return new Promise((resolve, reject) => {
    return shipEngine
      .post(
        `tracking/stop?carrier_code=${carrierCode}&tracking_number=${trackingNumber}`
      )
      .then(() => {
        return shipEngine
          .post(
            `tracking/start?carrier_code=${carrierCode}&tracking_number=${trackingNumber}`
          )
          .then(() => {
            resolve({ carrierCode, trackingNumber })
          })
          .catch(error => reject(error))
      })
      .catch(error => reject(error))
  })
}

module.exports = {
  createShipment,
  createShipmentLabel,
  startTracking
}

const _transformAddress = moltinAddress => {
  // incoming { first_name, last_name, phone_number, company_name, line_1, line_2, city, postcode, county, country, instructions }
  // should return { name, phone, company_name, address_line1, city_locality, state_province, postal_code, country_code }
  const {
    phone_number: phone,
    company: company_name,
    line_1: address_line1,
    city: city_locality,
    postcode: postal_code,
    country: country_code
  } = moltinAddress
  const name =
    moltinAddress.name ||
    `${moltinAddress.first_name} ${moltinAddress.last_name}`
  const state_province = _abbreviate(moltinAddress.county)

  return {
    name,
    phone,
    company_name,
    address_line1,
    city_locality,
    state_province,
    postal_code,
    country_code
  }
}

const _transformParcels = parcels => {
  // incoming [{ length, width, height, dimensions_unit, weight, weight_unit }]
  // should return [{ weight: { value, unit }, dimensions: { unit, length, width, height } }]
  return parcels.map(parcel => {
    return {
      weight: { value: parcel.weight, unit: parcel.weight_unit },
      dimensions: {
        unit: parcel.dimensions_unit,
        length: parcel.length,
        width: parcel.width,
        height: parcel.height
      }
    }
  })
}

const _defaultFromAddress = {
  //TODO!!!!!!!!!!!!!: remove hardcode
  name: 'XXXXXX',
  company_name: 'XXXXXX',
  line_1: '123 XXXXXX',
  city: 'Miami Beach',
  county: 'FL',
  postcode: '33139',
  country: 'US',
  phone_number: '1234567890',
  email: 'XXX@XXX.XX'
}

const _defaultParcel = {
  //TODO!!!!!!!!!!!!!: remove hardcode
  length: '18',
  width: '12',
  height: '6',
  dimensions_unit: 'inch',
  weight: '2',
  weight_unit: 'pound'
}

const _abbreviate = state => {
  return state.length > 2
    ? _stateAbbreviations.find(stateEntry => stateEntry.value === state).label
    : state
}

const _stateAbbreviations = [
  {
    value: null,
    label: 'State'
  },
  {
    value: 'Alabama',
    label: 'AL'
  },
  {
    value: 'Alaska',
    label: 'AK'
  },
  {
    value: 'American Samoa',
    label: 'AS'
  },
  {
    value: 'Arizona',
    label: 'AZ'
  },
  {
    value: 'Arkansas',
    label: 'AR'
  },
  {
    value: 'California',
    label: 'CA'
  },
  {
    value: 'Colorado',
    label: 'CO'
  },
  {
    value: 'Connecticut',
    label: 'CT'
  },
  {
    value: 'Delaware',
    label: 'DE'
  },
  {
    value: 'District Of Columbia',
    label: 'DC'
  },
  {
    value: 'Federated States Of Micronesia',
    label: 'FM'
  },
  {
    value: 'Florida',
    label: 'FL'
  },
  {
    value: 'Georgia',
    label: 'GA'
  },
  {
    value: 'Guam',
    label: 'GU'
  },
  {
    value: 'Hawaii',
    label: 'HI'
  },
  {
    value: 'Idaho',
    label: 'ID'
  },
  {
    value: 'Illinois',
    label: 'IL'
  },
  {
    value: 'Indiana',
    label: 'IN'
  },
  {
    value: 'Iowa',
    label: 'IA'
  },
  {
    value: 'Kansas',
    label: 'KS'
  },
  {
    value: 'Kentucky',
    label: 'KY'
  },
  {
    value: 'Louisiana',
    label: 'LA'
  },
  {
    value: 'Maine',
    label: 'ME'
  },
  {
    value: 'Marshall Islands',
    label: 'MH'
  },
  {
    value: 'Maryland',
    label: 'MD'
  },
  {
    value: 'Massachusetts',
    label: 'MA'
  },
  {
    value: 'Michigan',
    label: 'MI'
  },
  {
    value: 'Minnesota',
    label: 'MN'
  },
  {
    value: 'Mississippi',
    label: 'MS'
  },
  {
    value: 'Missouri',
    label: 'MO'
  },
  {
    value: 'Montana',
    label: 'MT'
  },
  {
    value: 'Nebraska',
    label: 'NE'
  },
  {
    value: 'Nevada',
    label: 'NV'
  },
  {
    value: 'New Hampshire',
    label: 'NH'
  },
  {
    value: 'New Jersey',
    label: 'NJ'
  },
  {
    value: 'New Mexico',
    label: 'NM'
  },
  {
    value: 'New York',
    label: 'NY'
  },
  {
    value: 'North Carolina',
    label: 'NC'
  },
  {
    value: 'North Dakota',
    label: 'ND'
  },
  {
    value: 'Northern Mariana Islands',
    label: 'MP'
  },
  {
    value: 'Ohio',
    label: 'OH'
  },
  {
    value: 'Oklahoma',
    label: 'OK'
  },
  {
    value: 'Oregon',
    label: 'OR'
  },
  {
    value: 'Palau',
    label: 'PW'
  },
  {
    value: 'Pennsylvania',
    label: 'PA'
  },
  {
    value: 'Puerto Rico',
    label: 'PR'
  },
  {
    value: 'Rhode Island',
    label: 'RI'
  },
  {
    value: 'South Carolina',
    label: 'SC'
  },
  {
    value: 'South Dakota',
    label: 'SD'
  },
  {
    value: 'Tennessee',
    label: 'TN'
  },
  {
    value: 'Texas',
    label: 'TX'
  },
  {
    value: 'Utah',
    label: 'UT'
  },
  {
    value: 'Vermont',
    label: 'VT'
  },
  {
    value: 'Virgin Islands',
    label: 'VI'
  },
  {
    value: 'Virginia',
    label: 'VA'
  },
  {
    value: 'Washington',
    label: 'WA'
  },
  {
    value: 'West Virginia',
    label: 'WV'
  },
  {
    value: 'Wisconsin',
    label: 'WI'
  },
  {
    value: 'Wyoming',
    label: 'WY'
  }
]
