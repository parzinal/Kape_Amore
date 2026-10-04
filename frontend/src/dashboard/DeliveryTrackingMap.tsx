import { useEffect, useMemo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import type { LatLngExpression } from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { CustomerDeliveryTracking } from "./adminApi";
import { tw } from "../tw";

function FitLocations({ locations }: { locations: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 1) {
      map.fitBounds(latLngBounds(locations), { padding: [48, 48], maxZoom: 15 });
    } else if (locations.length === 1) {
      map.setView(locations[0], 14);
    }
  }, [locations, map]);

  return null;
}

function distanceBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function trackingTimeLabel(value: string | null): string {
  if (!value) return "Waiting for the driver to share location";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Updated just now";
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)} min ago`;
  return `Last update at ${new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function DeliveryTrackingMap({ delivery }: { delivery: CustomerDeliveryTracking }) {
  const hasDriver = delivery.rider_latitude !== null && delivery.rider_longitude !== null;
  const hasDestination = delivery.customer_latitude !== null && delivery.customer_longitude !== null;
  const driver = hasDriver
    ? { latitude: delivery.rider_latitude!, longitude: delivery.rider_longitude! }
    : null;
  const destination = hasDestination
    ? { latitude: delivery.customer_latitude!, longitude: delivery.customer_longitude! }
    : null;
  const locations = useMemo<Array<[number, number]>>(() => [
    ...(driver ? [[driver.latitude, driver.longitude] as [number, number]] : []),
    ...(destination ? [[destination.latitude, destination.longitude] as [number, number]] : []),
  ], [delivery.customer_latitude, delivery.customer_longitude, delivery.rider_latitude, delivery.rider_longitude]);
  const center: LatLngExpression = locations[0] ?? [14.5995, 120.9842];
  const distanceKm = driver && destination ? distanceBetween(driver, destination) : null;
  const etaMinutes = distanceKm === null ? null : Math.max(1, Math.ceil(distanceKm * 1.3 / 12 * 60));
  const driverIcon = divIcon({
    className: "delivery-map-marker delivery-map-marker-rider",
    html: '<span aria-hidden="true">🚗</span>',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
  const destinationIcon = divIcon({
    className: "delivery-map-marker delivery-map-marker-customer",
    html: '<span aria-hidden="true">⌂</span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
  const route: Array<[number, number]> = driver && destination
    ? [[driver.latitude, driver.longitude], [destination.latitude, destination.longitude]]
    : [];

  return (
    <section className={tw("delivery-tracking-card")} aria-label={`Live tracking for order ${delivery.order_number}`}>
      <div className={tw("delivery-tracking-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>DELIVERY TRACKING</p>
          <h3>Order {delivery.order_number}</h3>
        </div>
        <span className={tw(`delivery-tracking-status delivery-tracking-status-${delivery.status}`)}>{delivery.status.replace(/_/g, " ")}</span>
      </div>
      <div className={tw("delivery-tracking-map")}>
        {locations.length === 0 ? (
          <div className={tw("delivery-map-waiting")}>
            <span aria-hidden="true">⌖</span>
            <strong>Tracking will appear when your driver starts their route</strong>
            <p>Your delivery is being prepared. This map will update automatically once a location is available.</p>
          </div>
        ) : (
          <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitLocations locations={locations} />
            {destination && <Marker icon={destinationIcon} position={[destination.latitude, destination.longitude]} title="Delivery destination" />}
            {driver && <Marker icon={driverIcon} position={[driver.latitude, driver.longitude]} title={delivery.rider_name ? `Driver: ${delivery.rider_name}` : "Driver"} />}
            {route.length > 0 && <Polyline className={tw("delivery-map-route")} positions={route} />}
          </MapContainer>
        )}
      </div>
      <div className={tw("delivery-tracking-footer")}>
        {distanceKm !== null && etaMinutes !== null ? (
          <>
            <div><span className={tw("delivery-tracking-metric-icon")} aria-hidden="true">↗</span><span><small>Driver distance</small><strong>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}</strong></span></div>
            <div><span className={tw("delivery-tracking-metric-icon")} aria-hidden="true">◷</span><span><small>Estimated arrival</small><strong>About {etaMinutes} min</strong></span></div>
          </>
        ) : (
          <p>{hasDestination ? "Your delivery destination is marked. The driver’s location will appear once they start sharing." : "Add your delivery location next time to see your position alongside the driver."}</p>
        )}
      </div>
      <p className={tw("delivery-tracking-updated")}>{trackingTimeLabel(delivery.rider_location_updated_at)} · Approximate distance and ETA</p>
    </section>
  );
}
