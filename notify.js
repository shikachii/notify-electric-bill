const queries = {
  monthlyReadings: `query monthlyReadings(
    $accountNumber: String!
  ) {
    account(accountNumber: $accountNumber) {
      properties {
        electricitySupplyPoints {
          agreements {
            validFrom
          }
          intervalReadings {
            endAt
            startAt
            value
            costEstimate
          }
        }
      }
    }
  }`,
  halfHourlyReadings: `query halfHourlyReadings(
    $accountNumber: String!, $fromDatetime: DateTime, $toDatetime: DateTime
  ) {
    account(accountNumber: $accountNumber) {
      properties {
        electricitySupplyPoints {
          agreements {
            validFrom
          }
          halfHourlyReadings(fromDatetime: $fromDatetime, toDatetime: $toDatetime) {
            startAt
            value
            costEstimate
            consumptionStep
            consumptionRateBand
          }
        }
      }
    }
  }`
}

const API_URL = "https://api.oejp-kraken.energy/v1/graphql/";
const properties = PropertiesService.getUserProperties();

const getDateSTr = () => {
  const iso = new Date().toISOString();

  const now = new Date()
  now.setDate(now.getDate() - 1)
  now.setHours(0, 0, 0, 0)
  console.log(iso, now.toISOString())
  console.log(iso)
}

function getElectricBill() {
  refreshToken();
  const token = properties.getProperty('token')

  const toDatetime = new Date(); // 2023-07-01T19:00:00.000Z 付近 日本時間7/2 4:00
  const fromDatetime = new Date()
  fromDatetime.setDate(toDatetime.getDate() - 1)
  fromDatetime.setHours(0, 0, 0, 0)
  toDatetime.setHours(0, 30, 0, 0)

  console.log(fromDatetime, toDatetime);

  const variables = {
    accountNumber: "A-99F3E7A3",
    // 4時間前のデータは少なくとも取得できそう
    fromDatetime: fromDatetime.toISOString(),
    toDatetime: toDatetime.toISOString()
  }

  const params = {
    method: "POST",
    contentType: "application/json",
    headers: {
      "Authorization": token
    },
    payload: JSON.stringify({
      query: queries.halfHourlyReadings,
      variables,
    }),
  }

  try {
    const response = UrlFetchApp.fetch(API_URL, params).getContentText();
    // console.log(response);

    const result = JSON.parse(response);

    const halfHourlyReadings = result.data.account.properties[0].electricitySupplyPoints[0].halfHourlyReadings;

    const values = halfHourlyReadings.map(({ startAt, value, costEstimate }) => {
      return {
        startAt,
        value: `${value}kwh`,
        costEstimate: `${costEstimate}円`
      };
    })
    console.log(values);

    const totalCost = halfHourlyReadings.reduce((prev, { costEstimate }) => {
      return prev + parseFloat(costEstimate);
    }, 0.0)
    console.log(`${totalCost}円`)

    GmailApp.sendEmail("shikachii095+notifyElectricBill@gmail.com", "電気代通知", `昨日の電気代は ${totalCost} 円でした．\n\n https://octopusenergy.co.jp/account/A-99F3E7A3/usage`)
  } catch(err) {
    console.error(err)
  }
}

function refreshToken() {
  const scriptProperties = PropertiesService.getScriptProperties();

  const query = `mutation login($input: ObtainJSONWebTokenInput!) {
    obtainKrakenToken(input: $input) {
      token
      refreshToken
    }
  }`;
  const variables = {
    "input": {
      "email": scriptProperties.getProperty("email"),
      "password": scriptProperties.getProperty("password")
    },
  }

  const params = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify({
        query,
        variables,
      })
    }

  try {
    const response = UrlFetchApp.fetch(API_URL, params)
    const result = JSON.parse(response.getContentText());

    properties.setProperty('token', result.data.obtainKrakenToken.token)
    properties.setProperty('refreshToken', result.data.obtainKrakenToken.refreshToken)
  } catch(err) {
    console.log(err);
  }
}
