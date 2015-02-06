// var React = require('react');

var _ = require('lodash');
var math = require('mathjs');
var numeral = require('numeral');

var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter();

React.initializeTouchEvents(true);

var MetrocardApp = React.createClass({

  getInitialState: function() {
    return {transactions: [], balance: ''};
  },

  componentDidMount: function() {
    events.addListener('digit', this.pushDigit);
    events.addListener('popDigit', this.popDigit);
  },

  componentWillUnmount: function() {
    events.removeListener('digit', this.pushDigit);
    events.removeListener('popDigit', this.popDigit);
  },

  pushDigit: function(digit) {
    console.log(digit, this.state.balance);
    this.setState({balance: this.state.balance + '' + digit});
    console.log('post balance', this.state.balance);
    this.updateBuys(calculate_spending(this.state.balance));
  },

  popDigit: function() {
    console.log('popDigit');
    this.setState({balance: ('' + this.state.balance).slice(0,-1)});
  },

  updateBuys: function(data) {
    this.setState({ transactions: data});
  },

  render: function() {
    return(
      <div className="app">
        <ValueForm updateBuys={this.updateBuys} balance={this.state.balance} />
        <KeyPad />
        <BuyList transactions={this.state.transactions} />
        <hr />
        <BuyList transactions={this.state.transactions} debug={true} />
      </div>
     );
  }
});


var ValueForm = React.createClass({

    handleSubmit: function(e) {
        e.preventDefault();
        var value = this.refs.value.getDOMNode().value;
        value = parseFloat(value/100, 10);
        // console.log(value, this.refs.value.getDOMNode().value);
        this.props.updateBuys(calculate_spending(value));
    },

  getInitialState: function() {
    return {balance: null};
  },

    componentDidMount: function() {
      $('#initial-value').focus();
    },

    render: function() {
        // var money = '$' + this.props.balance / 100;
        var money = numeral(this.props.balance / 100).format('$0.00');
        return (
            <div>
            <div>
              {money}
              <BackspaceButton />
            </div>
            </div>
        );
            // <form className="metrocard-value" onChange={this.handleSubmit}>
            //   <label for="initial-value">What’s on your Metrocard?</label>
            //   <input id="initial-value" className="form-control" type="number" ref="value" placeholder="$ 0.00" value={this.props.balance} />
            // </form>
    }
});


var BuyList = React.createClass({

  render: function() {
    var showDebug = this.props.debug;
    console.log('this.props.tranactions', this.props.transactions);
    var transactions = this.props.transactions.map(function(t) {
      return (
        <BuyCard data={t} debug={showDebug} />
      );
    });

    return (
      <div>
      { transactions }
      </div>
    );
  }

});



var BuyCard = React.createClass({
  render: function() {
    var items = [];
    if (this.props.debug === true) {
      items = _.omit(this.props.data, ['initial_value', 'rides'])
      items = _.map(items, function(val, key) {
        return (
          <li><small><strong>{key}:</strong> {val}</small></li>
        );
      });
    }
    console.log('items', items);
    return (
      <div className="transaction">
      <strong>Buy this: ${this.props.data.purchase}</strong> (${this.props.data.total_with_bonus.toFixed(2)} total, {this.props.data.rides} rides)
      <ul className="debug">
      {items}
      </ul>
      </div>
    );
  }
});

var KeyPad = React.createClass({
  render: function() {
    return (
      <div id="keypad">
         <NumberButton value="1" />
         <NumberButton value="2" />
         <NumberButton value="3" />
         <br />
         <NumberButton value="4" />
         <NumberButton value="5" />
         <NumberButton value="6" />
         <br />
         <NumberButton value="7" />
         <NumberButton value="8" />
         <NumberButton value="9" />
         <br />
         <NumberButton value="0" />
      </div>
    );
  }
});

var NumberButton = React.createClass({
      getInitialState: function() {
        return {
          active: false
        };
      },

      clickHandler: function() {
        // console.log(this.props.value);
                events.emit('digit', this.props.value);

        //         this.setState({
        //   'active': true
        // });

      },

      touchStart: function() {
        console.log('touchStart');
        this.setState({
          'active': true
        })
      },
      touchEnd: function() {
        console.log('touchEnd');
        this.setState({
          'active': false
        })
      },
      render: function() {
          var activeClass = (this.state.active) ? ' active' : '';
          return (
              <div
              className={"number-button" + activeClass}
                onTouchStart={this.touchStart}
                onTouchEnd={this.touchEnd}
                onClick={this.clickHandler}><span>{this.props.value}</span></div>
    );
  }
})

var BackspaceButton = React.createClass({
  clickHandler: function() {
    events.emit('popDigit');
  },
  render: function() {
    return (
            <a className="back-button" onClick={this.clickHandler}>⌫</a>
            // <button className="back-button" onClick={this.clickHandler}>⌫</button>
    );
  }
});


React.render(
  <MetrocardApp />,
  document.getElementById('content')
);



var fare = 2.5; // current MTA fare price in NYC
var bonus_min = 5;  // Purcahse price above which bonus value is added
var bonus = 1.05;  // Actual value of dollars spent above bonus_min


var max_card_value = 50; // Maximum Metrocard value that will be calculated

/**
 * [calculate_spending description]
 * @param  {[type]} initial_value [description]
 * @return {[type]}               [description]
 */
var calculate_spending = function(initial_value) {
  var transactions = []; // suggested purchase amounts
  console.log(initial_value);
  for (var i = 2; i <= (max_card_value / fare); i++) {
    var target = i * fare;
    var purchase = (target - initial_value) / bonus;
    if (target < initial_value || purchase < bonus_min) {
      console.log('continuing (fail) with target', target, 'and purchase', purchase);
      continue;
    }
    if (Math.round(purchase * 100) % 5 === 0) {

      var transaction = {
        purchase: purchase.toFixed(2),
        raw_purchase: purchase,
        advantage: purchase - math.round(purchase, 2),
        bonus: (purchase * 0.05).toFixed(2),
        raw_bonus: purchase * 0.05,
        total_sans_bonus: initial_value + purchase,
        total_with_bonus: target,
        rides: target/fare,
        initial_value: initial_value
      }
      transactions.push(transaction);
      // console.log(details);
      console.log('initial value: $%s;  target: $%s;  purchase: $%s', initial_value, target.toFixed(2), purchase.toFixed(2));
    } else {
      // console.log('      initial value: $%s;  target: $%s;  purchase: $%s', initial_value, target.toFixed(2), purchase.toFixed(2));
    }
  }
  console.table(transactions);
  return transactions;
}
