import * as echarts from '../ec-canvas/echarts';

let names = []
let numbers = []
let Chart = null

Page({
  data: {
    ec: {
      // onInit: initChart
      lazyLoad: true // 延迟加载
    },
    // time: 30 * 60 * 60 * 1000,
    angle: {
      xAxis: 10,
      yAxis: 10,
      zAxis: 10
    },
    acceleration: {
      Xdirection: Array(200).fill(0),
      Ydirection: Array(200).fill(0),
      Zdirection: Array(200).fill(0)
    },
    chs: [],
    connected: false,
    showDeviceList: false,
    result: "抬手",
    devices: [],

    // devices: [{
    //     name: '小天才',
    //     subname: 'UUID: E123ASJD-SDJKL2-YJHGJ3-12JDK2'
    //   },
    //   {
    //     name: 'Apple Watch',
    //     subname: 'UUID: E123ASJD-SDJKL2-YJHGJ3-12JDK2'
    //   },
    //   {
    //     name: 'Huawei Watch',
    //     subname: 'UUID: E123ASJD-SDJKL2-YJHGJ3-12JDK2'
    //   },
    // ],
    names: [],
    times: []
  },

  onLoad: function () {
    this.echartsComponnet = this.selectComponent('#mychart-dom-line')
    this.init_echarts()

  },
  toggle(type) {
    this.setData({
      [type]: !this.data[type],
    });
  },
  onSelect(e) {
    let device = e.detail
    let devices = this.data.devices
    this.createBLEConnection(device)
  },
  //识别的一个字符将剩余字符转为十进制数字
  getData(str) {
    let result = []
    let data = []
    let that = this
    const flags = [33, 64, 35, 36, 94, 38];
    for (let i = 0; i < str.length; i += 2) {
      data.push(Number(str.slice(i, i + 2)))
    }
    if (flags.includes(data[0])) {
      let flag = data.shift()
      data = data.map(String.fromCharCode).join("")
      for (let i = 0; i < data.length; i += 3)
        result.push(data[i])
      result = Number(result.join(""))
      switch (flag) {
        case 33:
          that.data.angle.xAxis = result;
          break;
        case 64:
          that.data.angle.yAxis = result;
          break;
        case 35:
          that.data.angle.zAxis = result;
          break;
        case 36:
          that.data.acceleration.Xdirection.push((result));
          that.data.acceleration.Xdirection.shift();
          break;
        case 94:
          that.data.acceleration.Ydirection.push(result);
          that.data.acceleration.Ydirection.shift();
          break;
        case 38:
          that.data.acceleration.Zdirection.push(result);
          that.data.acceleration.Zdirection.shift();
          break;
      }
    }
    this.setData(that.data)
  },




  Connect() {
    this.toggle('showDeviceList')
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        this.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange(function (res) {
            console.log('onBluetoothAdapterStateChange', res)
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        if (res.discovering) {
          this.onBluetoothDeviceFound()
        } else if (res.available) {
          this.startBluetoothDevicesDiscovery()
        }
      }
    })
  },
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
    })
  },
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
          data[`devices[${idx}]`].id = idx
          data[`devices[${idx}]`].subname = 'UUID: ' + device.deviceId
          this.setData(data)
        }
        this.setData(data)
      })
    })
  },
  createBLEConnection(device) {
    // const ds = e.currentTarget.dataset
    const deviceId = device.deviceId
    const name = device.name
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
        })
        wx.showToast({
            title: '连接成功',
            icon: 'success'
          }),
          this.getBLEDeviceServices(deviceId)
      }
    })
    this.stopBluetoothDevicesDiscovery()
  },
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      connected: false,
      chs: [],
      canWrite: false,
    })
  },
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      }
    })
  },
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    let that = this
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            this.writeBLECharacteristicValue()
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
              success: function (res) {
                wx.onBLECharacteristicValueChange(res => {
                  // console.log('characteristic value comed:', ab2dec(res.value))
                  let result = Number((ab2dec(res.value))).toString()
                  that.getData(result)
                  Chart.setOption(that.getOption())
                })
              }
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
    // 操作之前先监听，保证第一时间获取数据
    // wx.onBLECharacteristicValueChange((characteristic) => {
    //   // let result = Number(ab2dec(characteristic.value))
    //   // console.log(result,"result");

    //   // const idx = inArray(this.data.chs, 'uuid', characteristic.characteristicId)
    //   // const data = {}
    //   // if (idx === -1) {
    //   //   data[`chs[${this.data.chs.length}]`] = {
    //   //     uuid: characteristic.characteristicId,
    //   //     value: ab2hex(characteristic.value)
    //   //   }
    //   // } else {
    //   //   data[`chs[${idx}]`] = {
    //   //     uuid: characteristic.characteristicId,
    //   //     value: ab2hex(characteristic.value)
    //   //   }
    //   // }
    //   // // data[`chs[${this.data.chs.length}]`] = {
    //   // //   uuid: characteristic.characteristicId,
    //   // //   value: ab2hex(characteristic.value)
    //   // // }
    //   // console.log(ab2dec(characteristic.value));
    //   // this.setData(data)
    //   // console.log(data,"Asdasdasd");
    //   // console.log(this.data, " aaaaaa  ");
    // })
  },
  writeBLECharacteristicValue() {
    // 向蓝牙设备发送一个0x00的16进制数据
    let buffer = new ArrayBuffer(1)
    let dataView = new DataView(buffer)
    dataView.setUint8(0, Math.random() * 255 | 0)
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
    })
  },
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },


  init_echarts: function () {
    this.echartsComponnet.init((canvas, width, height, dpr) => {
      // 初始化图表
      Chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      Chart.setOption(this.getOption());
      // 注意这里一定要返回 chart 实例，否则会影响事件处理等
      return Chart;
    });
  },
  getOption: function () {
    // 指定图表的配置项和数据
    let option = {
      title: {
        text: '加速度',
        left: 'left',
        top: 18,
        left: 10
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['X轴', 'Y轴', 'Z轴'],
        show: true,
        z: 999,
        right: 15,
        top: 20,

      },
      xAxis: [{
        type: 'category',
        // data: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        axisTick: {
          alignWithLabel: true
        }
      }],
      yAxis: [{
        type: 'value',
        scale: true,
        min: -20,
        max:20,
        position: 'left'
      }],
      series: [{
        name: 'X轴',
        type: 'line',
        id: 0,
        barWidth: '60%',
        animation: false,
        data: this.data.acceleration.Xdirection
      }, {
        name: 'Y轴',
        type: 'line',
        id: 1,
        barWidth: '60%',
        animation: false,
        data: this.data.acceleration.Ydirection
      }, {
        name: 'Z轴',
        type: 'line',
        id: 2,
        barWidth: '60%',
        animation: false,
        data: this.data.acceleration.Zdirection
      }],
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        }
      }
    }
    return option;
  },
});



function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进制字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

// ArrayBuffer转10进制字符串示例
function ab2dec(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(10)).slice(-2)
    }
  )
  return hexArr.join('');
}