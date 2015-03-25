// var React = require('react');

var _ = require('lodash');
var math = require('mathjs');
var numeral = require('numeral');

var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter();

React.initializeTouchEvents(true);

var MetrocardApp = React.createClass({

  getInitialState: function() {
    return {transactions: [], balance: 0};
  },

  componentDidMount: function() {
    events.addListener('digit', this.pushDigit);
    events.addListener('backspace', this.popDigit);
  },

  componentWillUnmount: function() {
    events.removeListener('digit', this.pushDigit);
    events.removeListener('backspace', this.popDigit);
  },

  pushDigit: function(digit) {
    var b = math
      .chain(this.state.balance)
      .multiply(1000)
      .add(digit)
      .divide(100)
      .done();
    this.updateBuys(b);
  },

  popDigit: function() {
    var b = math
      .chain(this.state.balance)
      .multiply(10)
      .floor()
      .divide(100)
      .done();
    this.updateBuys(b);
  },

  updateBuys: function(balance) {
    this.setState({
        balance: balance,
        transactions: calculateSpending(balance)
    });
  },

  render: function() {
    return(
      <div className="app">
        <BalanceDisplay balance={this.state.balance} />
        <KeyPad />
        <BuyList transactions={this.state.transactions} />
        <hr />
        <BuyList transactions={this.state.transactions} debug={true} />
      </div>
     );
  }
});


var BalanceDisplay = React.createClass({
    render: function() {
        var money = numeral(this.props.balance).format('$0.00');
        return (
          <div>
              <div className="balance">
                  {money}
              </div>
          </div>
        );
    }
});


var BuyList = React.createClass({
  render: function() {
    var showDebug = this.props.debug;
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
      // items = _.omit(this.props.data, ['initial_value', 'rides'])
      items = _.map(this.props.data, function(val, key) {
        return (
          <li><small><strong>{key}:</strong> {val}</small></li>
        );
      });
    }
    return (
      <div className="transaction">
          <strong>
              Buy: <span  className="white">${this.props.data.purchase}</span>
          </strong> ${this.props.data.total_with_bonus.toFixed(2)} total, {this.props.data.rides} rides
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
            <div>
                <NumberButton value={1} />
                <NumberButton value={2} />
                <NumberButton value={3} />
            </div>
            <div>
                <NumberButton value={4} />
                <NumberButton value={5} />
                <NumberButton value={6} />
            </div>
            <div>
                <NumberButton value={7} />
                <NumberButton value={8} />
                <NumberButton value={9} />
            </div>
            <NumberButton value={0} />
                              <BackspaceButton />

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
        events.emit('digit', this.props.value);
      },

      touchStart: function() {
        console.log('touchStart');
        this.setState({
          'active': true
        })
      },
      touchEnd: function(foo) {
        console.log('touchEnd', foo);
        events.emit('digit', this.props.value)
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
                  onTouchEnd={this.touchEnd}>
                    <span>{this.props.value}</span>
              </div>
    );
  }
})

var BackspaceButton = React.createClass({
  touchEnd: function() {
    events.emit('backspace');
  },
  render: function() {
    return (
      <a className="back-button" onTouchEnd={this.touchEnd}>⌫</a>
    );
  }
});

React.render(
  <MetrocardApp />,
  document.getElementById('content')
);



var fare = 2.75; // current MTA fare price in NYC
var bonus_min = 5.5;  // Purcahse price above which bonus value is added
var bonus = 0.11;  // Actual value of dollars spent above bonus_min
var dollar_value = 1 + bonus;  // Actual value of dollars spent above bonus_min


var max_card_value = 50; // Maximum Metrocard value that will be calculated

/**
 * [calculateSpending description]
 * @param  {[type]} initial_value [description]
 * @return {[type]}               [description]
 */
var calculateSpending = function(initial_value) {
  console.log('!!!!! initial_value:', initial_value);
  var transactions = []; // suggested purchase amounts
  console.log(initial_value);
  for (var i = 2; i <= (max_card_value / fare); i++) {
    var target = i * fare;
    var purchase = (target - initial_value) / dollar_value;
    if (target < initial_value || purchase < bonus_min) {
      console.log('continuing (fail) with target', target, 'and purchase', purchase);
      continue;
    }
    if (Math.round(purchase * 100) % 5 === 0) {

      var transaction = {
        purchase: purchase.toFixed(2),
        raw_purchase: purchase,
        advantage: purchase - math.round(purchase, 2),
        bonus: (purchase * bonus).toFixed(2),
        raw_bonus: purchase * bonus,
        total_sans_bonus: initial_value + purchase,
        total_with_bonus: target,
        rides: target / fare,
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