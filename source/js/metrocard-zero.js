// var React = require('react');

var _ = require('lodash');
var MetrocardApp = React.createClass({

  getInitialState: function() {
    return {transactions: []};
  },

  updateBuys: function(data) {
    this.setState({ transactions: data});
  },

  render: function() {
    return(
      <div className="app">
        <ValueForm updateBuys={this.updateBuys} />
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

    componentDidMount: function() {
      $('#initial-value').focus();
    },

    render: function() {
        return (
            <form className="metrocard-value" onChange={this.handleSubmit}>
              <label for="initial-value">What’s on your Metrocard?</label>
              <input id="initial-value" className="form-control" type="number" ref="value" placeholder="$ 0.00" />
            </form>

        );
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
      items = _.map(this.props.data, function(val, key) {
        return(
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
        bonus: (purchase * 0.05).toFixed(2),
        raw_bonus: purchase * 0.5,
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
