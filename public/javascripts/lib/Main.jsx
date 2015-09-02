import React from 'react'
import Data from './data.es6'

export default class Main extends React.Component {

  static renderOnServer(props) {
    return React.renderToString(React.createElement(this, props))
  }

  static reinflateOnClient(containerId) {
    let node = document.getElementById(containerId)
    let props = JSON.parse(node.getAttribute('data-react-props'))
    React.render(React.createElement(this, props), node)
  }

  componentDidMount() {
    let data = window.data = new Data()
    data.parse(this.props)
  }

  render() {
    return <div>
      <h1>{this.props.url}</h1>
      <pre>{JSON.stringify(this.props, null, '  ')}</pre>
    </div>
  }
}
